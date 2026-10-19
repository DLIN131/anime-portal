// AniList 沒有中文資料，這裡把作品對應到人工整理的中文名稱與 Bangumi 條目（不使用機器翻譯）：
//   1. 動畫先查 bangumi-data（以 AniList ID 對應，有官方繁中 / 簡中譯名）
//   2. Wikidata（以 AniList ID 對應）的 zh-tw / zh-cn 標籤，多為台灣、大陸代理商的正式譯名
//   3. Bangumi 條目的中文名；沒有中文名時改用條目別名或 AniList 同義名中的中文名稱
//   查不到任何中文名稱時保留日文原名，結果快取在瀏覽器
import { useEffect, useState } from 'react';
import type { Media, MediaType } from './anilist';
import { bangumiIdOf, loadBangumiData } from './bangumiData';
import { getSubject, type BgmSubject } from './bgmApi';
import { isTraditional, useZh } from './zh';

export interface ZhInfo {
  /** 繁體譯名（台灣代理名稱優先） */
  tw: string | null;
  /** 簡體譯名（大陸譯名或 Bangumi 中文名） */
  cn: string | null;
  bgmId: number | null;
}

type MediaRef = Pick<Media, 'id' | 'type' | 'title' | 'synonyms'>;

const EMPTY: ZhInfo = { tw: null, cn: null, bgmId: null };

const STORAGE_KEY = 'zh-title-cache-v3';
const store: Record<string, ZhInfo> = (() => {
  try {
    for (const old of ['zh-title-cache-v1', 'zh-title-cache-v2']) localStorage.removeItem(old);
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
})();

let saveTimer: number | undefined;
function save() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* 空間不足或無法存取時忽略 */
    }
  }, 500);
}

const KANA = /[぀-ヿ]/;
const HAN = /[一-鿿]/;

/** 有漢字、沒有假名才算中文名稱 */
const looksChinese = (s: string) => HAN.test(s) && !KANA.test(s);

/** 依字形放進繁體或簡體欄位，已有的值不覆蓋 */
function fill(info: ZhInfo, name: string | null | undefined) {
  const s = name?.trim();
  if (!s) return;
  if (isTraditional(s)) info.tw ??= s;
  else info.cn ??= s;
}

// ---------- bangumi-data 對應表 ----------
let animeIndex: Promise<Map<number, ZhInfo>> | null = null;
function loadAnimeIndex() {
  if (!animeIndex) {
    animeIndex = loadBangumiData().then((data) => {
      const map = new Map<number, ZhInfo>();
      for (const it of data.items) {
        const al = it.sites.find((s) => s.site === 'aniList')?.id;
        if (!al) continue;
        const bgm = bangumiIdOf(it);
        map.set(Number(al), {
          tw: it.titleTranslate['zh-Hant']?.[0] ?? null,
          cn: it.titleTranslate['zh-Hans']?.[0] ?? null,
          bgmId: bgm ? Number(bgm) : null,
        });
      }
      return map;
    });
    animeIndex.catch(() => (animeIndex = null));
  }
  return animeIndex;
}

// ---------- Wikidata（同一時間的查詢合併成一次 SPARQL） ----------
const WD_PROP: Record<MediaType, string> = { ANIME: 'P8729', MANGA: 'P8731' };
const WD_BATCH = 80;

interface WdBatch {
  ids: number[];
  result: Promise<Map<number, ZhInfo>>;
}
const wdBatches: Partial<Record<MediaType, WdBatch>> = {};

async function queryWikidata(type: MediaType, ids: number[]): Promise<Map<number, ZhInfo>> {
  const sparql = `SELECT ?al ?label ?bgm WHERE {
    VALUES ?al { ${ids.map((id) => `"${id}"`).join(' ')} }
    ?item wdt:${WD_PROP[type]} ?al.
    OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) IN ("zh-tw", "zh-hant", "zh-cn", "zh-hans", "zh")) }
    OPTIONAL { ?item wdt:P5732 ?bgm }
  }`;
  const r = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`);
  if (!r.ok) throw new Error(String(r.status));
  type Cell = { value: string; 'xml:lang'?: string };
  const { results } = (await r.json()) as { results: { bindings: Record<string, Cell | undefined>[] } };

  const labels = new Map<number, Record<string, string>>();
  const bgmIds = new Map<number, number>();
  for (const row of results.bindings) {
    const id = Number(row.al!.value);
    const byLang = labels.get(id) ?? {};
    labels.set(id, byLang);
    if (row.label) byLang[row.label['xml:lang']!] = row.label.value;
    if (row.bgm && !bgmIds.has(id)) bgmIds.set(id, Number(row.bgm.value));
  }

  const map = new Map<number, ZhInfo>();
  for (const [id, l] of labels) {
    const info: ZhInfo = {
      tw: l['zh-tw'] ?? l['zh-hant'] ?? null,
      cn: l['zh-cn'] ?? l['zh-hans'] ?? null,
      bgmId: bgmIds.get(id) ?? null,
    };
    // 「zh」標籤字形不固定，依內容判斷
    if (l.zh && looksChinese(l.zh)) fill(info, l.zh);
    map.set(id, info);
  }
  return map;
}

function lookupWikidata(type: MediaType, id: number): Promise<ZhInfo | undefined> {
  let batch = wdBatches[type];
  if (!batch || batch.ids.length >= WD_BATCH) {
    const ids: number[] = [];
    const created: WdBatch = {
      ids,
      result: new Promise((r) => setTimeout(r, 50)).then(() => {
        if (wdBatches[type] === created) delete wdBatches[type];
        return queryWikidata(type, ids);
      }),
    };
    batch = wdBatches[type] = created;
  }
  batch.ids.push(id);
  return batch.result.then((m) => m.get(id));
}

// ---------- Bangumi（限制同時請求數） ----------
const queue: (() => Promise<void>)[] = [];
let running = 0;
const MAX_CONCURRENT = 3;

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(() => job().then(resolve, reject));
    pump();
  });
}

function pump() {
  while (running < MAX_CONCURRENT && queue.length) {
    const job = queue.shift()!;
    running++;
    job().finally(() => {
      running--;
      pump();
    });
  }
}

const normalize = (s: string) => s.replace(/[\s・·:：!！‼?？\-－~～〜、，,.。'"「」『』()（）[\]【】]/g, '').toLowerCase();

type BgmHit = Pick<BgmSubject, 'id' | 'name' | 'name_cn' | 'platform' | 'series' | 'infobox'>;

interface BgmMatch {
  subject: BgmHit;
  /** 同一作品的其他條目（彩色版、原作小說等），主條目沒有中文名時參考 */
  related: BgmHit[];
}

async function searchBangumi(keyword: string, type: MediaType): Promise<BgmMatch | undefined> {
  const r = await fetch('https://api.bgm.tv/v0/search/subjects?limit=10', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, filter: { type: [type === 'ANIME' ? 2 : 1] } }),
  });
  if (!r.ok) throw new Error(String(r.status));
  const { data } = (await r.json()) as { data: BgmHit[] };
  const key = normalize(keyword);
  // 書籍類同名的還有小說、單行本，漫畫系列條目優先
  const rank = (d: BgmHit) => (d.series !== false ? 0 : 2) + (type === 'ANIME' || d.platform === '漫画' ? 0 : 1);
  const exact = data.filter((d) => normalize(d.name) === key).sort((a, b) => rank(a) - rank(b));
  const subject = exact[0] ?? data.find((d) => normalize(d.name).startsWith(key) && d.series !== false);
  if (!subject) return undefined;
  const related = key.length >= 4 ? data.filter((d) => d !== subject && normalize(d.name).startsWith(key)) : [];
  return { subject, related };
}

/** 去掉「-楽園編-」「～副標～」「@COMIC」等後綴，找不到時用主標題再查一次 */
function baseTitle(s: string): string | null {
  const m = s.match(/^(.{4,}?)\s*[-－～〜(（@].*$/);
  return m && normalize(m[1]) !== normalize(s) ? m[1] : null;
}

/** 中文名，沒有時找條目別名裡的中文（非官方標記的排在後面） */
function bgmChineseNames(s: BgmHit): string[] {
  const names: string[] = [];
  if (s.name_cn) names.push(s.name_cn);
  const unofficial: string[] = [];
  for (const entry of s.infobox ?? []) {
    if (entry.key !== '中文名' && entry.key !== '别名') continue;
    const values = typeof entry.value === 'string' ? [{ v: entry.value }] : entry.value;
    for (const { k, v } of values) {
      if (!looksChinese(v) || normalize(v) === normalize(s.name)) continue;
      (k?.includes('非官方') ? unofficial : names).push(v);
    }
  }
  return names.concat(unofficial);
}

async function fromBangumi(media: MediaRef, bgmId: number | null): Promise<BgmMatch | undefined> {
  if (bgmId) return { subject: await getSubject(bgmId), related: [] };
  const keyword = media.title.native ?? media.title.romaji;
  if (!keyword) return undefined;
  const hit = await searchBangumi(keyword, media.type);
  if (hit) return hit;
  const base = baseTitle(keyword);
  return base ? searchBangumi(base, media.type) : undefined;
}

async function lookup(media: MediaRef): Promise<ZhInfo> {
  const info: ZhInfo = { ...EMPTY };
  const merge = (src: ZhInfo | null | undefined) => {
    if (!src) return;
    info.tw ??= src.tw;
    info.cn ??= src.cn;
    info.bgmId ??= src.bgmId;
  };

  if (media.type === 'ANIME') merge((await loadAnimeIndex().catch(() => null))?.get(media.id));
  if (!info.tw || !info.cn) merge(await lookupWikidata(media.type, media.id).catch(() => undefined));

  // 繁簡都有、也知道 Bangumi 條目時就不必再查
  if (info.tw && info.cn && info.bgmId) return info;

  const match = await enqueue(() => fromBangumi(media, info.bgmId)).catch(() => undefined);
  const subject = match?.subject;
  if (subject) {
    info.bgmId ??= subject.id;
    if (subject.name_cn) fill(info, subject.name_cn);
  }
  if (info.tw || info.cn) return info;

  // 沒有正式中文名：AniList 同義名中的中文名稱，再來是 Bangumi 別名、同作品其他條目的中文名
  const native = normalize(media.title.native ?? '');
  const synonym = media.synonyms.find((s) => looksChinese(s) && normalize(s) !== native);
  const bgmNames = match ? [match.subject, ...match.related].flatMap(bgmChineseNames) : [];
  fill(info, synonym ?? bgmNames[0]);
  return info;
}

const pending = new Map<string, Promise<ZhInfo>>();

export function resolveZh(media: MediaRef): Promise<ZhInfo> {
  const key = `${media.type}:${media.id}`;
  if (store[key]) return Promise.resolve(store[key]);
  let p = pending.get(key);
  if (!p) {
    p = lookup(media).then((info) => {
      store[key] = info;
      save();
      return info;
    });
    pending.set(key, p);
    p.catch(() => pending.delete(key));
  }
  return p;
}

export function useZhInfo(media: MediaRef | undefined): ZhInfo | undefined {
  const key = media ? `${media.type}:${media.id}` : '';
  const [info, setInfo] = useState<ZhInfo | undefined>(() => store[key]);
  useEffect(() => {
    if (!media) return;
    let alive = true;
    setInfo(store[key]);
    resolveZh(media).then(
      (i) => alive && setInfo(i),
      () => {},
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return info;
}

/** 依目前繁簡模式取中文名：同字形的譯名直接使用，沒有時才由另一種字形轉換 */
export function useZhName(info: ZhInfo | undefined): string | null {
  const { mode, t } = useZh();
  if (!info) return null;
  // 資料來源偶有把簡體標成繁體（或反過來），不是純繁體的名稱一律再轉換
  if (mode === 'tw') return info.tw && isTraditional(info.tw) ? info.tw : t(info.tw ?? info.cn) || null;
  return t(info.cn ?? info.tw) || null;
}
