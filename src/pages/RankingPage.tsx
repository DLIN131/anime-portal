import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import RankCard from '../components/RankCard';
import SeasonPicker from '../components/SeasonPicker';
import { ErrorBox, Loading } from '../components/Status';
import { ANIME_FORMATS, fetchRanking, MANGA_FORMATS, type Media, type MediaType, type RankSort } from '../lib/anilist';
import { currentSeason, isPeriod, PERIOD_LABEL } from '../lib/season';

const SORT_LABEL: Record<RankSort, string> = {
  POPULARITY_DESC: '人氣',
  SCORE_DESC: '評分',
  TRENDING_DESC: '近期熱度',
  FAVOURITES_DESC: '最愛數',
};

export default function RankingPage({ type }: { type: MediaType }) {
  const params = useParams();
  const year = Number(params.year);
  const period = params.period;
  const basePath = type === 'ANIME' ? '/anime' : '/manga';
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

  const load = async (p: number) => {
    if (!valid) return;
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetchRanking({ type, year, period, sort, formats, page: p });
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
  }, [type, year, period, sort, formats.join()]);

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
      <div className="page-head">
        <h1>
          {year} 年 {PERIOD_LABEL[period]} 日本{type === 'ANIME' ? '動畫' : '漫畫'}排行
        </h1>
        <SeasonPicker basePath={basePath} year={year} period={period} minYear={1970} maxYear={currentSeason().year + (type === 'ANIME' ? 1 : 0)} />
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
        {type === 'ANIME' ? '以開播日期' : '以開始連載日期'}歸類，共 {total.toLocaleString('zh-TW')} 部 · 人氣為 AniList 收藏人數
      </p>

      {error && <ErrorBox error={error} />}
      {items.length === 0 && loading && <Loading />}
      {items.length === 0 && !loading && !error && <div className="status">這段期間沒有作品資料。</div>}

      {items.length > 0 && (
        <div className="grid">
          {items.map((m, i) => (
            <RankCard key={m.id} media={m} rank={i + 1} sort={sort} />
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
