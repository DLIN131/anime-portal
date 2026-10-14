export type Season = 'winter' | 'spring' | 'summer' | 'fall';

export const SEASONS: Season[] = ['winter', 'spring', 'summer', 'fall'];

export const SEASON_LABEL: Record<Season, string> = {
  winter: '冬季・1月',
  spring: '春季・4月',
  summer: '夏季・7月',
  fall: '秋季・10月',
};

export const SEASON_SHORT: Record<Season, string> = {
  winter: '冬',
  spring: '春',
  summer: '夏',
  fall: '秋',
};

const START_MONTH: Record<Season, number> = { winter: 1, spring: 4, summer: 7, fall: 10 };

export function isSeason(s: string | undefined): s is Season {
  return !!s && (SEASONS as string[]).includes(s);
}

/** month: 1-12 */
export function seasonOfMonth(month: number): Season {
  return SEASONS[Math.floor((month - 1) / 3)];
}

export function currentSeason(now = new Date()): { year: number; season: Season } {
  return { year: now.getFullYear(), season: seasonOfMonth(now.getMonth() + 1) };
}

/** 回傳該季的日期區間 [start, end)，格式 YYYY-MM-DD */
export function seasonRange(year: number, season: Season): [string, string] {
  const m = START_MONTH[season];
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${year}-${pad(m)}-01`;
  const end = m === 10 ? `${year + 1}-01-01` : `${year}-${pad(m + 3)}-01`;
  return [start, end];
}

/** 季度，或 'year' 代表全年 */
export type Period = Season | 'year';

export const PERIOD_LABEL: Record<Period, string> = { ...SEASON_LABEL, year: '全年' };

export function isPeriod(s: string | undefined): s is Period {
  return s === 'year' || isSeason(s);
}

export function periodRange(year: number, period: Period): [string, string] {
  if (period === 'year') return [`${year}-01-01`, `${year + 1}-01-01`];
  return seasonRange(year, period);
}

export function shiftSeason(year: number, season: Season, delta: number) {
  const idx = year * 4 + SEASONS.indexOf(season) + delta;
  return { year: Math.floor(idx / 4), season: SEASONS[((idx % 4) + 4) % 4] };
}

const JST_OFFSET = 9 * 3600 * 1000;

/** 以日本時間判斷開播日期所屬的年份與季度 */
export function seasonOfIso(iso: string): { year: number; season: Season } | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t + JST_OFFSET);
  return { year: d.getUTCFullYear(), season: seasonOfMonth(d.getUTCMonth() + 1) };
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 將 ISO 時間格式化成台灣時間 (UTC+8) 的「週X HH:mm」 */
export function formatAirTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + 8 * 3600 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `週${WEEKDAYS[d.getUTCDay()]} ${hh}:${mm}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const d = new Date(t + JST_OFFSET);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}
