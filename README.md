# 日本動漫人氣榜

以年份與季度分類的日本動畫、漫畫與韓漫人氣排行網站（React + Vite + TypeScript），內容以繁體中文顯示，可切換簡體。

## 資料來源

- [AniList](https://anilist.co) GraphQL API：排行（收藏人數、評分、熱度、最愛數）、作品資訊、官方 PV
- [bangumi-data](https://github.com/bangumi-data/bangumi-data)：動畫的繁中譯名
- [Wikidata](https://www.wikidata.org)：以 AniList ID 對應的台灣 / 大陸正式譯名
- [Bangumi 番組計劃](https://bgm.tv) API：中文名稱與中文簡介

皆為免費開放 API，不需要金鑰。

## 開發

```bash
npm install
npm run dev
```

## 部署

推送到 `main` 後，GitHub Actions 會自動建置並發布到 GitHub Pages。
