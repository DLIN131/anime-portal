import { useNavigate } from 'react-router-dom';
import { PERIOD_LABEL, SEASONS, shiftSeason, type Period } from '../lib/season';

interface Props {
  basePath: string;
  year: number;
  period: Period;
  /** 目前在歷年總排行 */
  allTime?: boolean;
  minYear: number;
  maxYear: number;
}

const PERIODS: Period[] = ['year', ...SEASONS];

export default function SeasonPicker({ basePath, year, period, allTime = false, minYear, maxYear }: Props) {
  const navigate = useNavigate();
  const go = (y: number, p: Period) => navigate(`${basePath}/${y}/${p}`);
  const prev = period === 'year' ? { year: year - 1, season: period } : shiftSeason(year, period, -1);
  const next = period === 'year' ? { year: year + 1, season: period } : shiftSeason(year, period, 1);
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);

  return (
    <div className="season-picker">
      <button className="nav-btn" disabled={allTime || prev.year < minYear} onClick={() => go(prev.year, prev.season)} aria-label="上一期">
        ‹
      </button>
      <select value={allTime ? '' : year} onChange={(e) => go(Number(e.target.value), period)} aria-label="年份">
        {allTime && (
          <option value="" disabled>
            選擇年份
          </option>
        )}
        {years.map((y) => (
          <option key={y} value={y}>
            {y} 年
          </option>
        ))}
      </select>
      <div className="season-tabs">
        <button className={allTime ? 'on' : ''} onClick={() => navigate(`${basePath}/all`)}>
          總排行
        </button>
        {PERIODS.map((p) => (
          <button key={p} className={!allTime && p === period ? 'on' : ''} onClick={() => go(year, p)}>
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
      <button className="nav-btn" disabled={allTime || next.year > maxYear} onClick={() => go(next.year, next.season)} aria-label="下一期">
        ›
      </button>
    </div>
  );
}
