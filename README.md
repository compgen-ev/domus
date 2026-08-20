# Domus

An open-data platform for house history. Search and contribute the history of buildings — who lived there, who owned it, how addresses changed over time. Data is stored in Wikidata; building shapes come from OpenHistoricalMap.

There is no backend: the app runs entirely in the browser against public APIs, and everything it writes goes into public collaborative databases under CC0.

A [CompGen](https://www.compgen.de/) project, live at [domus.genealogy.net](https://domus.genealogy.net/).

The platform is described in [_Domus: An Open-Data Web Platform for House History Research_](https://arxiv.org/abs/2608.12566) (arXiv:2608.12566); see [CITATION.cff](CITATION.cff) for how to cite it.

## Dev

```bash
npm install
npm run dev      # landing at localhost:5173/, map at localhost:5173/map/
npm run build    # → dist/index.html (landing) + dist/map/ (app)
npm run preview  # preview the build at localhost:4173/

npm test         # vitest (watch mode); npx vitest run for a single pass
npx tsc --noEmit # type check
```

Editing requires logging in with a Wikimedia and/or OpenHistoricalMap account. Both use OAuth 2.0 with PKCE straight from the browser — there are no secrets to configure, and a separate dev OAuth consumer is selected automatically on localhost.

## Localisation

The source locale is **German** — write UI strings in German, wrapped in `msg()` from `@lit/localize`. After adding or changing one:

```bash
npx lit-localize extract   # updates xliff/en.xlf
# add the English translation to xliff/en.xlf
npx lit-localize build     # regenerates src/locales/ and src/locale-codes.ts
```

`src/locales/*.ts` and `src/locale-codes.ts` are generated, are not committed, and must never be edited by hand. `npm run build` runs `lit-localize build` first.

## Maintenance

### Building types

The client-side building type filter (`src/services/building-types.ts`) is a static snapshot of the Wikidata types that are subclasses of Q41176 (building) or instances of Q811102 (type of building). Regenerate it after relevant Wikidata changes:

```bash
python3 scripts/update-building-types.py
```

## Deployment

Pushes to `main` are built and deployed to GitHub Pages by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which runs the test suite first. The site is served at [domus.genealogy.net](https://domus.genealogy.net/).

## Stack

| | |
|---|---|
| UI | Lit 3 + TypeScript, localised with `@lit/localize` |
| Map | MapLibre GL JS + OpenFreeMap, OHM vector tiles for historical layers |
| Read | Wikidata SPARQL (`query.wikidata.org`), OHM Overpass, Nominatim, Wikimedia Commons |
| Write | Wikidata REST API (`wikibase/v1`), OHM API 0.6 — both via OAuth 2.0 in the browser |
| Build | Vite 6, Vitest + happy-dom |

## Licence

MIT — see [LICENSE](LICENSE).
