// 開放資料：bangumi-data (https://github.com/bangumi-data/bangumi-data)
// 收錄番劇的中文譯名、播出時間與正版播放平台
import { seasonOfIso, type Season } from './season';

const DATA_URL = 'https://cdn.jsdelivr.net/npm/bangumi-data@0.3/dist/data.json';

export type AnimeType = 'tv' | 'web' | 'movie' | 'ova';

export interface SiteRef {
  site: string;
  id?: string;
  url?: string;
  begin?: string;
  broadcast?: string;
}

export interface SiteMeta {
  title: string;
  urlTemplate: string;
  type: 'info' | 'onair' | 'resource';
  regions?: string[];
}

export interface AnimeItem {
  title: string;
  titleTranslate: Record<string, string[] | undefined>;
  type: AnimeType;
  lang: string;
  officialSite: string;
  begin: string;
  broadcast?: string;
  end: string;
  sites: SiteRef[];
}

export interface BangumiData {
  siteMeta: Record<string, SiteMeta>;
  items: AnimeItem[];
}

let cache: Promise<BangumiData> | null = null;

export function loadBangumiData(): Promise<BangumiData> {
  if (!cache) {
    cache = fetch(DATA_URL).then((r) => {
      if (!r.ok) throw new Error(`載入番劇資料失敗 (${r.status})`);
      return r.json() as Promise<BangumiData>;
    });
    cache.catch(() => (cache = null));
  }
  return cache;
}

export function bangumiIdOf(item: AnimeItem): string | undefined {
  return item.sites.find((s) => s.site === 'bangumi')?.id;
}

/** 優先使用繁中譯名，其次簡中，最後原名 */
export function chineseTitle(item: AnimeItem): string {
  return item.titleTranslate['zh-Hant']?.[0] ?? item.titleTranslate['zh-Hans']?.[0] ?? item.title;
}

export function itemsOfSeason(data: BangumiData, year: number, season: Season): AnimeItem[] {
  return data.items.filter((it) => {
    const s = it.begin ? seasonOfIso(it.begin) : null;
    return s?.year === year && s.season === season;
  });
}

export function findByBangumiId(data: BangumiData, id: string): AnimeItem | undefined {
  return data.items.find((it) => bangumiIdOf(it) === id);
}

export function yearRange(data: BangumiData): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const it of data.items) {
    const y = it.begin ? seasonOfIso(it.begin)?.year : undefined;
    if (y) {
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
  }
  return [min, max];
}

export function siteUrl(meta: SiteMeta | undefined, ref: SiteRef): string | undefined {
  if (ref.url) return ref.url;
  if (!meta || !ref.id) return undefined;
  return meta.urlTemplate.replace('{{id}}', ref.id);
}

/** 以 YouTube 播放清單提供正版免費播放的官方頻道，可直接嵌入站內播放 */
export const YOUTUBE_SITES = new Set(['ani_one', 'ani_one_asia', 'muse_tw', 'muse_hk', 'tropics', 'mighty', 'youtube']);

export const TYPE_LABEL: Record<AnimeType, string> = {
  tv: 'TV',
  web: 'WEB',
  movie: '劇場版',
  ova: 'OVA',
};

export const REGION_LABEL: Record<string, string> = {
  CN: '中國大陸',
  TW: '台灣',
  HK: '香港',
  MO: '澳門',
  JP: '日本',
  US: '美國',
};
