# Domus

A map that shows buildings from Wikidata. Zoom in past level 14 to see pins; click a pin for details. Early-stage frontend for a planned open data house history platform.


## Dev

```bash
npm install
npm run dev        # http://localhost:5173 — hot reload on file save
npm run build      # type-check + production bundle → dist/
```

## Stack

| | |
|---|---|
| UI | Lit 3 + TypeScript |
| Map | MapLibre GL JS + OpenFreeMap |
| Data | Wikidata SPARQL API |
| Build | Vite 6 |
