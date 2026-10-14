import { useNavigate, useParams } from 'react-router-dom';
import { formatCount, useDisplayTitle } from '../components/RankCard';
import { ErrorBox, Loading } from '../components/Status';
import {
  FORMAT_LABEL,
  formatFuzzy,
  GENRE_LABEL,
  getMediaDetail,
  LIST_STATUS_LABEL,
  roleLabel,
  SOURCE_LABEL,
  STATUS_LABEL,
  trailerEmbedUrl,
  type MediaDetail,
  type MediaType,
} from '../lib/anilist';
import { getSubject } from '../lib/bgmApi';
import { SEASON_SHORT, type Season } from '../lib/season';
import { useAsync } from '../lib/useAsync';
import { convertSummary, isJapanese, useZh } from '../lib/zh';

const ANILIST_SEASON: Record<string, Season> = { WINTER: 'winter', SPRING: 'spring', SUMMER: 'summer', FALL: 'fall' };

export default function DetailPage({ type }: { type: MediaType }) {
  const { id = '' } = useParams();
  const { data, error, loading } = useAsync(() => getMediaDetail(Number(id)), [id]);
  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;
  return <Detail media={data} type={type} />;
}

function Detail({ media: m, type }: { media: MediaDetail; type: MediaType }) {
  const navigate = useNavigate();
  const { t } = useZh();
  const { title, native, info } = useDisplayTitle(m);
  const bgm = useAsync(() => (info?.bgmId ? getSubject(info.bgmId) : Promise.resolve(null)), [info?.bgmId]);

  const unit = type === 'ANIME' ? '動畫' : '漫畫';
  const rankings = m.rankings
    .filter((r) => !r.allTime || r.rank <= 500)
    .map((r) => {
      const when = r.allTime ? '歷年' : `${r.year ?? ''}年${r.season ? `${SEASON_SHORT[ANILIST_SEASON[r.season]]}季` : ''}`;
      return { key: `${r.type}-${r.year}-${r.season}-${r.allTime}`, text: `${when}${r.type === 'POPULAR' ? '人氣' : '評分'}第 ${r.rank} 名` };
    });

  const staff = m.staff.edges
    .map((e) => ({ role: roleLabel(e.role), name: e.node.name.native ?? e.node.name.full }))
    .filter((s, i, arr): s is { role: string; name: string } => !!s.role && arr.findIndex((x) => x.role === s.role && x.name === s.name) === i);
  const studios = [...new Set(m.studios.nodes.filter((s) => s.isAnimationStudio).map((s) => s.name))];

  const dist = m.stats?.statusDistribution ?? [];
  const distTotal = dist.reduce((a, b) => a + b.amount, 0);

  const facts: [string, string][] = [
    ['類型', m.format ? FORMAT_LABEL[m.format] ?? m.format : ''],
    ['狀態', m.status ? STATUS_LABEL[m.status]?.[type] ?? m.status : ''],
    [type === 'ANIME' ? '開播' : '開始連載', formatFuzzy(m.startDate)],
    [type === 'ANIME' ? '完結' : '完結', formatFuzzy(m.endDate)],
    [type === 'ANIME' ? '集數' : '話數 / 卷數', type === 'ANIME' ? (m.episodes ? `${m.episodes} 集` : '') : [m.chapters && `${m.chapters} 話`, m.volumes && `${m.volumes} 卷`].filter(Boolean).join(' / ')],
    ['原作類型', m.source ? SOURCE_LABEL[m.source] ?? m.source : ''],
    ['動畫製作', studios.join('、')],
    ...staff.map((s) => [s.role, s.name] as [string, string]),
  ];

  const summary = bgm.data?.summary;

  return (
    <article className="detail">
      <button className="back" onClick={() => navigate(-1)}>
        ‹ 返回
      </button>

      {m.bannerImage && <div className="banner" style={{ backgroundImage: `url(${m.bannerImage})` }} />}

      <div className="detail-hero">
        <img className="detail-cover" src={m.coverImage.extraLarge} alt="" />
        <div className="detail-info">
          <h1>{title}</h1>
          {native !== title && <p className="original">{native}</p>}

          <div className="stats">
            <div>
              <strong>{m.averageScore ?? '—'}</strong>
              <span>平均評分</span>
            </div>
            <div>
              <strong>{formatCount(m.popularity)}</strong>
              <span>收藏人數</span>
            </div>
            <div>
              <strong>{formatCount(m.favourites)}</strong>
              <span>最愛人數</span>
            </div>
          </div>

          {rankings.length > 0 && (
            <div className="meta-row">
              {rankings.map((r) => (
                <span key={r.key} className="tag rank-tag">
                  🏆 {r.text}
                </span>
              ))}
            </div>
          )}

          <div className="tags">
            {m.genres.map((g) => (
              <span key={g} className="tag soft">
                {GENRE_LABEL[g] ?? g}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="detail-cols">
        <section className="panel">
          <h2>{unit}資訊</h2>
          <dl className="facts">
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <span key={k + v} style={{ display: 'contents' }}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </span>
              ))}
          </dl>
          <div className="info-links">
            作品資料：
            <a href={m.siteUrl} target="_blank" rel="noreferrer">
              AniList
            </a>
            {m.idMal && (
              <a href={`https://myanimelist.net/${type === 'ANIME' ? 'anime' : 'manga'}/${m.idMal}`} target="_blank" rel="noreferrer">
                MyAnimeList
              </a>
            )}
            {info?.bgmId && (
              <a href={`https://bgm.tv/subject/${info.bgmId}`} target="_blank" rel="noreferrer">
                Bangumi
              </a>
            )}
          </div>
        </section>

        {distTotal > 0 && (
          <section className="panel">
            <h2>用戶狀態分布</h2>
            <div className="dist-bar">
              {dist.map((d) => (
                <span key={d.status} className={`dist-${d.status}`} style={{ flex: d.amount }} />
              ))}
            </div>
            <ul className="dist-legend">
              {dist.map((d) => (
                <li key={d.status}>
                  <i className={`dist-${d.status}`} />
                  {LIST_STATUS_LABEL[d.status]?.[type] ?? d.status}
                  <b>{formatCount(d.amount)}</b>
                  <small>{((d.amount / distTotal) * 100).toFixed(1)}%</small>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {m.trailer && (
        <section className="panel">
          <h2>官方 PV</h2>
          <div className="player">
            <iframe
              src={trailerEmbedUrl(m.trailer)}
              title="官方 PV"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </section>
      )}

      <section className="panel">
        <h2>作品簡介</h2>
        {summary ? (
          <>
            {isJapanese(summary) && <p className="hint">目前只有日文官方簡介：</p>}
            <p className="summary">{convertSummary(t, summary)}</p>
          </>
        ) : bgm.loading || !info ? (
          <Loading text="載入中文簡介…" />
        ) : (
          <p className="hint">找不到這部作品的中文簡介。</p>
        )}
      </section>
    </article>
  );
}
