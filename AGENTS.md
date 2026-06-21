# Agent instructions

**Domus** — frontend-only house history app. No backend: data from Wikidata (REST API + OAuth) and OpenHistoricalMap.

## Quality Checks

After implementing or modifying code, **always** run:

```bash
npx tsc --noEmit   # TypeScript type checking
npm test           # Run all tests (or specific test file)
```

Fix any errors or warnings before considering the work complete.

## Localisation

UI strings live in Lit components wrapped with `msg()` (simple strings) or `msg(str\`…\`)` (strings with expressions). The source locale is **German (`de`)**  — write strings in German in the source code.

After adding or changing any `msg()` call:

```bash
npx lit-localize extract   # updates xliff/en.xlf with new/changed strings
# add translations to xliff/en.xlf
npx lit-localize build     # regenerates src/locales/en.ts and src/locale-codes.ts
```

`lit-localize build` also runs automatically at the start of `npm run build`.

**Never edit `src/locales/*.ts` or `src/locale-codes.ts` by hand** — they are generated and not committed to git.

Lit components that contain localised strings must carry the `@localized()` decorator so they re-render on locale change.
