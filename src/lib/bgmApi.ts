// 開放 API：Bangumi 番組計劃 (https://bangumi.github.io/api/)
import { seasonRange, type Season } from './season';

const API = 'https://api.bgm.tv/v0';

export interface BgmImages {
  large: string;
  common: string;
  medium: string;
  small: string;
  grid: string;
}

export interface BgmSubject {
  id: number;
  type: number;
  name: string;
  name_cn: string;
  summary: string;
  date: string | null;
  platform: string;
  images: BgmImages | null;
  tags: { name: string; count: number }[];
  rating?: { score: number; total: number; rank?: number };
  eps?: number;
  total_episodes?: number;
  volumes?: number;
  series?: boolean;
  nsfw?: boolean;
  infobox?: { key: string; value: string | { k?: string; v: string }[] }[];
}

export interface BgmEpisode {
  id: number;
  ep: number;
  sort: number;
  name: string;
  name_cn: string;
  airdate: string;
  duration: string;
  desc: string;
}

const memo = new Map<string, Promise<unknown>>();

function request<T>(path: string, init?: RequestInit): Promise<T> {
  const key = path + (init?.body ?? '');
  let p = memo.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fetch(API + path, init).then((r) => {
      if (!r.ok) throw new Error(`Bangumi API 錯誤 (${r.status})`);
      return r.json() as Promise<T>;
    });
    memo.set(key, p);
    p.catch(() => memo.delete(key));
  }
  return p;
}

export function coverUrl(bangumiId: string | number, size: 'small' | 'common' | 'large' = 'common') {
  return `${API}/subjects/${bangumiId}/image?type=${size}`;
}

export function getSubject(id: string | number) {
  return request<BgmSubject>(`/subjects/${id}`);
}

export async function getEpisodes(subjectId: string | number) {
  const res = await request<{ data: BgmEpisode[] }>(`/episodes?subject_id=${subjectId}&type=0&limit=200`);
  return res.data;
}

export interface MangaPage {
  items: BgmSubject[];
  total: number;
  nextOffset: number;
}

const PAGE = 50;

/** 搜尋某年某季開始連載 / 出版的漫畫系列 */
export async function searchSeasonManga(
  year: number,
  season: Season,
  sort: 'heat' | 'rank' | 'score',
  offset = 0,
): Promise<MangaPage> {
  const [start, end] = seasonRange(year, season);
  const res = await request<{ data: BgmSubject[]; total: number }>(`/search/subjects?limit=${PAGE}&offset=${offset}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: '',
      sort,
      filter: { type: [1], air_date: [`>=${start}`, `<${end}`], nsfw: false },
    }),
  });
  // 書籍類包含小說與單行本，只保留「漫畫」系列
  const items = res.data.filter((s) => s.platform === '漫画' && s.series !== false);
  return { items, total: res.total, nextOffset: offset + PAGE };
}

export function infoboxValue(s: BgmSubject, ...keys: string[]): string {
  for (const k of keys) {
    const entry = s.infobox?.find((i) => i.key === k);
    if (!entry) continue;
    if (typeof entry.value === 'string') return entry.value;
    return entry.value.map((v) => v.v).join('、');
  }
  return '';
}
