import React from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import { currentSeason } from './lib/season';
import { ZhProvider } from './lib/zh';
import DetailPage from './pages/DetailPage';
import HomePage from './pages/HomePage';
import RankingPage from './pages/RankingPage';
import './styles.css';

const now = currentSeason();

const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'anime', element: <Navigate to={`/anime/${now.year}/${now.season}`} replace /> },
      { path: 'anime/item/:id', element: <DetailPage type="ANIME" /> },
      { path: 'anime/:year/:period', element: <RankingPage key="anime" type="ANIME" /> },
      { path: 'manga', element: <Navigate to={`/manga/${now.year}/year`} replace /> },
      { path: 'manga/item/:id', element: <DetailPage type="MANGA" /> },
      { path: 'manga/finished', element: <Navigate to={`/manga/finished/${now.year}/year`} replace /> },
      { path: 'manga/finished/:year/:period', element: <RankingPage key="manga-finished" type="MANGA" by="end" /> },
      { path: 'manga/:year/:period', element: <RankingPage key="manga" type="MANGA" /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ZhProvider>
      <RouterProvider router={router} />
    </ZhProvider>
  </React.StrictMode>,
);
