import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchBuildingDetail } from './wikidata';
import { getLocale } from '../locale';

/** Stubs the SPARQL endpoint with one result row. */
function respondWith(row: Record<string, unknown>) {
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => ({ results: { bindings: [row] } }),
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchBuildingDetail aliases', () => {
  it('splits the label service literal into single names', async () => {
    respondWith({
      itemAltLabel: { type: 'literal', 'xml:lang': getLocale(), value: 'Müllerhof, Alte Schmiede' },
    });
    const detail = await fetchBuildingDetail('Q1');
    expect(detail.aliases).toEqual(['Müllerhof', 'Alte Schmiede']);
    expect(detail.aliasesLang).toBe(getLocale());
  });

  it('reports the language the fallback chain settled on', async () => {
    // Asking for de can still yield mul or en, whichever the item has first.
    respondWith({
      itemAltLabel: { type: 'literal', 'xml:lang': 'mul', value: 'Douglas N. Adams' },
    });
    const detail = await fetchBuildingDetail('Q1');
    expect(detail.aliases).toEqual(['Douglas N. Adams']);
    expect(detail.aliasesLang).toBe('mul');
  });

  it('reports no aliases and no language when the item has none', async () => {
    respondWith({});
    const detail = await fetchBuildingDetail('Q1');
    expect(detail.aliases).toEqual([]);
    expect(detail.aliasesLang).toBeUndefined();
  });
});
