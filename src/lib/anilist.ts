// 開放 API：AniList GraphQL (https://docs.anilist.co)
// 人氣排行：依日本作品 (countryOfOrigin: JP) 的開播 / 連載開始日期篩選
import { periodRange, type Period } from './season';

const API = 'https://graphql.anilist.co';

export type MediaType = 'ANIME' | 'MANGA';
export type RankSort = 'POPULARITY_DESC' | 'SCORE_DESC' | 'TRENDING_DESC' | 'FAVOURITES_DESC';

export interface Trailer {
  id: string;
  site: 'youtube' | 'dailymotion';
}

export interface FuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface Media {
  id: number;
  idMal: number | null;
  type: MediaType;
  format: string | null;
  status: string | null;
  title: { native: string | null; romaji: string | null; english: string | null };
  synonyms: string[];
  coverImage: { large: string; extraLarge: string; color: string | null };
  bannerImage: string | null;
  startDate: FuzzyDate;
  endDate: FuzzyDate;
  episodes: number | null;
  chapters: number | null;
  volumes: number | null;
  averageScore: number | null;
  popularity: number;
  favourites: number;
  trending: number;
  genres: string[];
  description: string | null;
  siteUrl: string;
}

export interface MediaDetail extends Media {
  trailer: Trailer | null;
  source: string | null;
  rankings: { rank: number; type: 'RATED' | 'POPULAR'; year: number | null; season: string | null; allTime: boolean }[];
  studios: { nodes: { name: string; isAnimationStudio: boolean }[] };
  staff: { edges: { role: string; node: { name: { native: string | null; full: string } } }[] };
  stats: { statusDistribution: { status: string; amount: number }[] } | null;
}

const MEDIA_FIELDS = `
  id idMal type format status
  title { native romaji english }
  synonyms
  coverImage { large extraLarge color }
  bannerImage
  startDate { year month day }
  endDate { year month day }
  episodes chapters volumes
  averageScore popularity favourites trending
  genres
  description(asHtml: false)
  siteUrl
`;

const memo = new Map<string, Promise<unknown>>();

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const key = query + JSON.stringify(variables);
  let p = memo.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    }).then(async (r) => {
      if (r.status === 429) throw new Error('AniList 請求太頻繁，請稍等一分鐘後再試');
      const j = await r.json();
      if (!r.ok || j.errors) throw new Error(`AniList API 錯誤：${j.errors?.[0]?.message ?? r.status}`);
      return j.data as T;
    });
    memo.set(key, p);
    p.catch(() => memo.delete(key));
  }
  return p;
}

export interface RankingPage {
  items: Media[];
  hasNextPage: boolean;
  total: number;
}

/** start：依開播 / 開始連載日期；end：依完結日期（只取已完結作品） */
export type RankBy = 'start' | 'end';

const RANKING_FILTER: Record<RankBy, string> = {
  start: 'startDate_greater: $from, startDate_lesser: $to',
  end: 'status: FINISHED, endDate_greater: $from, endDate_lesser: $to',
};

const rankingQuery = (by: RankBy) => `
query ($type: MediaType, $from: FuzzyDateInt, $to: FuzzyDateInt, $sort: [MediaSort], $formats: [MediaFormat], $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage total }
    media(type: $type, countryOfOrigin: JP, isAdult: false, ${RANKING_FILTER[by]},
          sort: $sort, format_in: $formats) {
      ${MEDIA_FIELDS}
    }
  }
}`;

export async function fetchRanking(opts: {
  type: MediaType;
  year: number;
  period: Period;
  by?: RankBy;
  sort: RankSort;
  formats: string[];
  page: number;
  perPage?: number;
}): Promise<RankingPage> {
  const [from, to] = periodRange(opts.year, opts.period);
  const data = await gql<{ Page: { pageInfo: { hasNextPage: boolean; total: number }; media: Media[] } }>(rankingQuery(opts.by ?? 'start'), {
    type: opts.type,
    // FuzzyDateInt 為 YYYYMMDD，greater / lesser 皆不含端點
    from: Number(from.replace(/-/g, '')) - 1,
    to: Number(to.replace(/-/g, '')),
    sort: [opts.sort, 'ID'],
    formats: opts.formats,
    page: opts.page,
    perPage: opts.perPage ?? 50,
  });
  return { items: data.Page.media, hasNextPage: data.Page.pageInfo.hasNextPage, total: data.Page.pageInfo.total };
}

const DETAIL_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    ${MEDIA_FIELDS}
    trailer { id site }
    source
    rankings { rank type year season allTime }
    studios { nodes { name isAnimationStudio } }
    staff(perPage: 8, sort: RELEVANCE) { edges { role node { name { native full } } } }
    stats { statusDistribution { status amount } }
  }
}`;

export async function getMediaDetail(id: number): Promise<MediaDetail> {
  const data = await gql<{ Media: MediaDetail }>(DETAIL_QUERY, { id });
  return data.Media;
}

export function trailerEmbedUrl(t: Trailer): string {
  return t.site === 'dailymotion'
    ? `https://www.dailymotion.com/embed/video/${encodeURIComponent(t.id)}`
    : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(t.id)}`;
}

export function formatFuzzy(d: FuzzyDate): string {
  if (!d.year) return '';
  return `${d.year}年${d.month ? `${d.month}月` : ''}${d.day ? `${d.day}日` : ''}`;
}

// ---------- 中文標籤 ----------

export const ANIME_FORMATS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV 短篇',
  MOVIE: '劇場版',
  OVA: 'OVA',
  ONA: '網路動畫',
  SPECIAL: '特別篇',
};

export const MANGA_FORMATS: Record<string, string> = {
  MANGA: '漫畫',
  ONE_SHOT: '短篇',
};

export const FORMAT_LABEL: Record<string, string> = { ...ANIME_FORMATS, ...MANGA_FORMATS, MUSIC: 'MV', NOVEL: '小說' };

export const STATUS_LABEL: Record<string, Record<MediaType, string>> = {
  FINISHED: { ANIME: '已完結', MANGA: '已完結' },
  RELEASING: { ANIME: '放送中', MANGA: '連載中' },
  NOT_YET_RELEASED: { ANIME: '尚未開播', MANGA: '尚未連載' },
  CANCELLED: { ANIME: '已取消', MANGA: '已腰斬' },
  HIATUS: { ANIME: '暫停中', MANGA: '休刊中' },
};

export const GENRE_LABEL: Record<string, string> = {
  Action: '動作',
  Adventure: '冒險',
  Comedy: '喜劇',
  Drama: '劇情',
  Ecchi: '擦邊',
  Fantasy: '奇幻',
  Horror: '恐怖',
  'Mahou Shoujo': '魔法少女',
  Mecha: '機甲',
  Music: '音樂',
  Mystery: '懸疑',
  Psychological: '心理',
  Romance: '戀愛',
  'Sci-Fi': '科幻',
  'Slice of Life': '日常',
  Sports: '運動',
  Supernatural: '超自然',
  Thriller: '驚悚',
};

export const SOURCE_LABEL: Record<string, string> = {
  ORIGINAL: '原創',
  MANGA: '漫畫改編',
  LIGHT_NOVEL: '輕小說改編',
  NOVEL: '小說改編',
  WEB_NOVEL: '網路小說改編',
  VISUAL_NOVEL: '視覺小說改編',
  VIDEO_GAME: '遊戲改編',
  GAME: '遊戲改編',
  OTHER: '其他',
  ANIME: '動畫',
  DOUJINSHI: '同人誌',
  MULTIMEDIA_PROJECT: '跨媒體企劃',
  PICTURE_BOOK: '繪本',
  COMIC: '漫畫改編',
  WEBTOON: '條漫改編',
  LIVE_ACTION: '真人作品',
};

export const LIST_STATUS_LABEL: Record<string, Record<MediaType, string>> = {
  CURRENT: { ANIME: '在看', MANGA: '在讀' },
  PLANNING: { ANIME: '想看', MANGA: '想讀' },
  COMPLETED: { ANIME: '看完', MANGA: '讀完' },
  DROPPED: { ANIME: '棄番', MANGA: '棄坑' },
  PAUSED: { ANIME: '擱置', MANGA: '擱置' },
};

export const ROLE_LABEL: [RegExp, string][] = [
  [/^Original Creator|^Original Story/i, '原作'],
  [/^Story & Art/i, '作者'],
  [/^Story( \(|$)/i, '原作'],
  [/^Art( \(|$)/i, '作畫'],
  [/^Director/i, '導演'],
  [/^Series Composition/i, '系列構成'],
  [/^Character Design/i, '角色設計'],
  [/^Music/i, '音樂'],
  [/^Script|^Screenplay/i, '腳本'],
];

export function roleLabel(role: string): string | null {
  for (const [re, label] of ROLE_LABEL) if (re.test(role)) return label;
  return null;
}
