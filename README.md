# Domus

An open-data platform for house history. Search and contribute the history of buildings — who lived there, who owned it, how addresses changed over time. Data is stored in Wikidata; building shapes come from OpenHistoricalMap.

A [CompGen](https://www.compgen.de/) project. Early stage.

## Dev

```bash
npm install
npm run dev      # landing at localhost:5173/, map at localhost:5173/map/
npm run build    # → dist/index.html (landing) + dist/map/ (app)
npm run preview  # preview the build at localhost:4173/
```

## Stack

| | |
|---|---|
| UI | Lit 3 + TypeScript |
| Map | MapLibre GL JS + OpenFreeMap |
| Data | Wikidata SPARQL + OpenHistoricalMap |
| Build | Vite 6 |
