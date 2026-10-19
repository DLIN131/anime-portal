import { Link } from 'react-router-dom';
import { RankRow } from '../components/RankCard';
import { ErrorBox, Loading } from '../components/Status';
import { fetchRanking, sectionPath, type Country, type MediaType } from '../lib/anilist';
import { currentSeason, PERIOD_LABEL, type Period } from '../lib/season';
import { useAsync } from '../lib/useAsync';

function TopList({ type, country, year, period, title }: { type: MediaType; country?: Country; year: number; period: Period; title: string }) {
  const formats = type === 'ANIME' ? ['TV', 'TV_SHORT', 'MOVIE', 'ONA', 'OVA'] : ['MANGA'];
  const { data, error, loading } = useAsync(
    () => fetchRanking({ type, country, year, period, sort: 'POPULARITY_DESC', formats, page: 1, perPage: 10 }),
    [type, country, year, period],
  );
  const base = sectionPath(type, country);
  return (
    <section className="panel top-list">
      <div className="top-list-head">
        <h2>{title}</h2>
        <Link to={`${base}/${year}/${period}`}>完整排行 ›</Link>
      </div>
      {error ? (
        <ErrorBox error={error} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        data.items.map((m, i) => <RankRow key={m.id} media={m} rank={i + 1} />)
      )}
    </section>
  );
}

export default function HomePage() {
  const now = currentSeason();
  // 漫畫的「當季新連載」資料往往要過一陣子才完整，首頁顯示今年度
  return (
    <>
      <div className="page-head">
        <h1>日本動畫・漫畫、韓漫人氣排行</h1>
      </div>
      <div className="home-grid">
        <TopList type="ANIME" year={now.year} period={now.season} title={`${now.year} 年${PERIOD_LABEL[now.season]}・動畫 TOP 10`} />
        <TopList type="ANIME" year={now.year} period="year" title={`${now.year} 年度・動畫 TOP 10`} />
        <TopList type="MANGA" year={now.year} period="year" title={`${now.year} 年新連載・漫畫 TOP 10`} />
        <TopList type="MANGA" year={now.year - 1} period="year" title={`${now.year - 1} 年新連載・漫畫 TOP 10`} />
        <TopList type="MANGA" country="KR" year={now.year} period="year" title={`${now.year} 年新連載・韓漫 TOP 10`} />
        <TopList type="MANGA" country="KR" year={now.year - 1} period="year" title={`${now.year - 1} 年新連載・韓漫 TOP 10`} />
      </div>
    </>
  );
}
