import { useEffect, useState } from 'react';
import { Navigate, NavLink, useParams } from 'react-router-dom';
import RankCard from '../components/RankCard';
import SeasonPicker from '../components/SeasonPicker';
import { ErrorBox, Loading } from '../components/Status';
import { ALL_TIME_MIN_POPULARITY, ANIME_FORMATS, fetchRanking, MANGA_FORMATS, sectionPath, type Media, type Country, type MediaType, type RankBy, type RankSort } from '../lib/anilist';
import { currentSeason, isPeriod, PERIOD_LABEL } from '../lib/season';

const SORT_LABEL: Record<RankSort, string> = {
  POPULARITY_DESC: '人氣',
  SCORE_DESC: '評分',
  TRENDING_DESC: '近期熱度',
  FAVOURITES_DESC: '最愛數',
};

interface Props {
  type: MediaType;
  country?: Country;
  by?: RankBy;
  /** 歷年總排行：不分年份 */
  allTime?: boolean;
}

export default function RankingPage({ type, country = 'JP', by = 'start', allTime = false }: Props) {
  const params = useParams();
  // 總排行沒有年份參數，年份選單預設停在今年
  const year = allTime ? currentSeason().year : Number(params.year);
  const period = allTime ? 'year' : params.period;
  const typePath = sectionPath(type, country);
  const basePath = by === 'end' ? `${typePath}/finished` : typePath;
  const formatLabels = type === 'ANIME' ? ANIME_FORMATS : MANGA_FORMATS;
  const defaultFormats = type === 'ANIME' ? ['TV', 'TV_SHORT', 'MOVIE', 'ONA', 'OVA'] : ['MANGA'];

  const [sort, setSort] = useState<RankSort>('POPULARITY_DESC');
  const [formats, setFormats] = useState<string[]>(defaultFormats);
  const [items, setItems] = useState<Media[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();

  const valid = isPeriod(period) && !!year;
  const suffix = allTime ? 'all' : `${year}/${period}`;

  const load = async (p: number) => {
    if (!valid) return;
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetchRanking({ type, year: allTime ? undefined : year, period, country, by, sort, formats, page: p });
      setItems((prev) => (p === 1 ? res.items : prev.concat(res.items)));
      setHasNext(res.hasNextPage);
      setTotal(res.total);
      setPage(p);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setFormats(defaultFormats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    setItems([]);
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, year, period, allTime, sort, formats.join()]);

  if (!valid) {
    const c = currentSeason();
    return <Navigate to={`${basePath}/${c.year}/${c.season}`} replace />;
  }

  const toggleFormat = (f: string) =>
    setFormats((prev) => {
      const next = prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f];
      return next.length ? next : prev;
    });

  return (
    <section>
      {type === 'MANGA' && (
        <nav className="list-tabs" aria-label={country === 'KR' ? '韓漫分類' : '漫畫分類'}>
          <NavLink to={`${typePath}/${suffix}`}>{allTime ? '全部' : '新連載'}</NavLink>
          <NavLink to={`${typePath}/finished/${suffix}`}>已完結</NavLink>
        </nav>
      )}
      <div className="page-head">
        <h1>
          {allTime ? '歷年' : `${year} 年 ${PERIOD_LABEL[period]} `}
          {by === 'end' ? '完結的' : ''}
          {country === 'KR' ? '韓國' : '日本'}
          {type === 'ANIME' ? '動畫' : '漫畫'}
          {allTime ? '總排行' : '排行'}
        </h1>
        <SeasonPicker basePath={basePath} year={year} period={period} allTime={allTime} minYear={1970} maxYear={currentSeason().year + (type === 'ANIME' ? 1 : 0)} />
      </div>

      <div className="toolbar">
        <div className="chips">
          {(Object.keys(SORT_LABEL) as RankSort[]).map((k) => (
            <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>
              依{SORT_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="chips formats">
          {Object.entries(formatLabels).map(([f, label]) => (
            <button key={f} className={formats.includes(f) ? 'on soft' : ''} onClick={() => toggleFormat(f)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="count">
        {allTime
          ? `不分年份${by === 'end' ? '、只列出已完結' : ''}，收藏超過 ${ALL_TIME_MIN_POPULARITY.toLocaleString('zh-TW')} 人的作品`
          : `${by === 'end' ? '以完結日期' : type === 'ANIME' ? '以開播日期' : '以開始連載日期'}歸類`}
        {/* AniList 的總數最多只回傳 5000，達到上限時不顯示 */}
        {total > 0 && total < 5000 && `，共 ${total.toLocaleString('zh-TW')} 部`} · 人氣為 AniList 收藏人數
      </p>

      {error && <ErrorBox error={error} />}
      {items.length === 0 && loading && <Loading />}
      {items.length === 0 && !loading && !error && <div className="status">這段期間沒有作品資料。</div>}

      {items.length > 0 && (
        <div className="grid">
          {items.map((m, i) => (
            <RankCard key={m.id} media={m} rank={i + 1} sort={sort} showRun={by === 'end'} />
          ))}
        </div>
      )}

      {items.length > 0 && hasNext && (
        <div className="more">
          <button disabled={loading} onClick={() => load(page + 1)}>
            {loading ? '載入中…' : '載入更多'}
          </button>
        </div>
      )}
    </section>
  );
}
