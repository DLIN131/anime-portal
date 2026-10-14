import { NavLink, Outlet } from 'react-router-dom';
import { useZh } from '../lib/zh';

export default function Layout() {
  const { mode, setMode } = useZh();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <span className="brand-mark">番</span>
            <span>{mode === 'tw' ? '日本動漫人氣榜' : '日本动漫人气榜'}</span>
          </NavLink>
          <nav className="mainnav">
            <NavLink to="/" end>{mode === 'tw' ? '總覽' : '总览'}</NavLink>
            <NavLink to="/anime">{mode === 'tw' ? '動畫排行' : '动画排行'}</NavLink>
            <NavLink to="/manga">{mode === 'tw' ? '漫畫排行' : '漫画排行'}</NavLink>
          </nav>
          <div className="zh-toggle" role="group" aria-label="字形">
            <button className={mode === 'tw' ? 'on' : ''} onClick={() => setMode('tw')}>
              繁
            </button>
            <button className={mode === 'cn' ? 'on' : ''} onClick={() => setMode('cn')}>
              简
            </button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <footer className="footer">
        <p>
          排行資料：
          <a href="https://anilist.co" target="_blank" rel="noreferrer">
            AniList
          </a>
          開放 API（日本作品，依收藏人數 / 評分排序）；中文名稱與簡介：
          <a href="https://github.com/bangumi-data/bangumi-data" target="_blank" rel="noreferrer">
            bangumi-data
          </a>
          、
          <a href="https://bgm.tv" target="_blank" rel="noreferrer">
            Bangumi 番組計劃
          </a>
          。
        </p>
      </footer>
    </>
  );
}
