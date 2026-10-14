// AniList 沒有中文資料，這裡把作品對應到中文名稱與 Bangumi 條目：
//   1. 動畫優先用 bangumi-data（以 AniList ID 對應，有官方繁中譯名）
//   2. 其餘用日文原名到 Bangumi 搜尋（結果快取在瀏覽器）
import { useEffect, useState } from 'react';
import type { Media, MediaType } from './anilist';
import { bangumiIdOf, loadBangumiData } from './bangumiData';

export interface ZhInfo {
  cn: string | null;
  bgmId: number | null;
}

const STORAGE_KEY = 'zh-title-cache-v1';
const store: Record<string, ZhInfo> = (() => {
  try {
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
          cn: it.titleTranslate['zh-Hant']?.[0] ?? it.titleTranslate['zh-Hans']?.[0] ?? null,
          bgmId: bgm ? Number(bgm) : null,
        });
      }
      return map;
    });
    animeIndex.catch(() => (animeIndex = null));
  }
  return animeIndex;
}

// ---------- Bangumi 搜尋（限制同時請求數） ----------
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

const normalize = (s: string) => s.replace(/[\s・·:：!！?？\-－~～、，,.。'"「」『』()（）[\]【】]/g, '').toLowerCase();

interface BgmHit {
  id: number;
  name: string;
  name_cn: string;
  series?: boolean;
}

async function searchBangumi(keyword: string, type: MediaType): Promise<ZhInfo> {
  const r = await fetch('https://api.bgm.tv/v0/search/subjects?limit=8', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, filter: { type: [type === 'ANIME' ? 2 : 1] } }),
  });
  if (!r.ok) throw new Error(String(r.status));
  const { data } = (await r.json()) as { data: BgmHit[] };
  const key = normalize(keyword);
  const hit =
    data.find((d) => normalize(d.name) === key && d.series !== false) ??
    data.find((d) => normalize(d.name) === key) ??
    data.find((d) => normalize(d.name).startsWith(key) && d.series !== false);
  return hit ? { cn: hit.name_cn || null, bgmId: hit.id } : { cn: null, bgmId: null };
}

const pending = new Map<string, Promise<ZhInfo>>();

export function resolveZh(media: Pick<Media, 'id' | 'type' | 'title'>): Promise<ZhInfo> {
  const key = `${media.type}:${media.id}`;
  if (store[key]) return Promise.resolve(store[key]);
  let p = pending.get(key);
  if (!p) {
    p = (async () => {
      if (media.type === 'ANIME') {
        const fromData = (await loadAnimeIndex().catch(() => null))?.get(media.id);
        if (fromData?.cn) return fromData;
      }
      const keyword = media.title.native ?? media.title.romaji;
      if (!keyword) return { cn: null, bgmId: null };
      return enqueue(() => searchBangumi(keyword, media.type));
    })().then((info) => {
      store[key] = info;
      save();
      return info;
    });
    pending.set(key, p);
    p.catch(() => pending.delete(key));
  }
  return p;
}

export function useZhInfo(media: Pick<Media, 'id' | 'type' | 'title'> | undefined): ZhInfo | undefined {
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
