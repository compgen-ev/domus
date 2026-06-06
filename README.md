# House History

An open data platform for exploring the history of buildings and places, built with [Lit](https://lit.dev/), [MapLibre GL JS](https://maplibre.org/), and [Wikidata](https://www.wikidata.org/).

## Features

- Full-screen interactive map (OpenFreeMap Liberty style, no API key required)
- Zoom in past level 14 to fetch and display buildings from Wikidata as pins
- Click any pin to see the building's name, type, construction date, and photo

## Dev

```bash
npm install
npm run dev        # http://localhost:5173 — hot reload on file save
```

```bash
npm run build      # type-check + production bundle → dist/
npm run preview    # serve the production build locally
```

## Stack

| Layer | Library |
|---|---|
| UI components | Lit 3 + TypeScript |
| Map | MapLibre GL JS 4 |
| Tiles | OpenFreeMap (Liberty style) |
| Building data | Wikidata SPARQL API |
| Build | Vite 6 |

## Project structure

```
src/
  components/
    app-root.ts        # root shell
    map-view.ts        # map + Wikidata integration
    building-popup.ts  # pin click popup
  services/
    wikidata.ts        # SPARQL fetch + GeoJSON conversion
  types/
    building.ts        # WikidataBuilding interface
  main.ts
```
