import { Link } from 'react-router-dom';
import { FORMAT_LABEL, GENRE_LABEL, type Media, type RankSort } from '../lib/anilist';
import { useZh } from '../lib/zh';
import { useZhInfo } from '../lib/zhTitle';

export function useDisplayTitle(media: Media | undefined) {
  const { t } = useZh();
  const info = useZhInfo(media);
  const native = media?.title.native ?? media?.title.romaji ?? '';
  return { title: info?.cn ? t(info.cn) : native, native, info };
}

export function formatCount(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)} 萬` : n.toLocaleString('zh-TW');
}

export function metricOf(m: Media, sort: RankSort): string {
  switch (sort) {
    case 'SCORE_DESC':
      return m.averageScore ? `${m.averageScore} 分` : '—';
    case 'TRENDING_DESC':
      return `熱度 ${m.trending}`;
    case 'FAVOURITES_DESC':
      return `${formatCount(m.favourites)} 人最愛`;
    default:
      return `${formatCount(m.popularity)} 人收藏`;
  }
}

export default function RankCard({ media, rank, sort }: { media: Media; rank: number; sort: RankSort }) {
  const { title, native } = useDisplayTitle(media);
  const path = media.type === 'ANIME' ? 'anime' : 'manga';
  return (
    <Link to={`/${path}/item/${media.id}`} className="card">
      <div className="cover" style={{ background: media.coverImage.color ?? undefined }}>
        <img src={media.coverImage.large} alt="" loading="lazy" />
        <span className={`rank rank-${rank <= 3 ? rank : 'n'}`}>{rank}</span>
        {media.format && <span className="badge">{FORMAT_LABEL[media.format] ?? media.format}</span>}
      </div>
      <div className="card-body">
        <h3 title={title}>{title}</h3>
        {native !== title && (
          <p className="sub" title={native}>
            {native}
          </p>
        )}
        <div className="card-foot">
          <span className="metric">{metricOf(media, sort)}</span>
          {media.averageScore && sort !== 'SCORE_DESC' ? <span className="score-mini">★ {media.averageScore}</span> : null}
        </div>
        <div className="genres">
          {media.genres.slice(0, 3).map((g) => (
            <span key={g}>{GENRE_LABEL[g] ?? g}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export function RankRow({ media, rank }: { media: Media; rank: number }) {
  const { title } = useDisplayTitle(media);
  const path = media.type === 'ANIME' ? 'anime' : 'manga';
  return (
    <Link to={`/${path}/item/${media.id}`} className="rank-row">
      <span className={`rank-no rank-${rank <= 3 ? rank : 'n'}`}>{rank}</span>
      <img src={media.coverImage.large} alt="" loading="lazy" />
      <div className="rank-row-body">
        <strong>{title}</strong>
        <small>
          {formatCount(media.popularity)} 人收藏
          {media.averageScore ? ` · ★ ${media.averageScore}` : ''}
        </small>
      </div>
    </Link>
  );
}
