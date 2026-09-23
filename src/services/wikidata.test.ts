import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchBuildingDetail } from './wikidata';
import { getLocale } from '../locale';

/** Stubs the SPARQL endpoint with the given result rows. */
function respondWithRows(rows: Record<string, unknown>[]) {
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => ({ results: { bindings: rows } }),
  }));
}

/** Stubs the SPARQL endpoint with one result row. */
function respondWith(row: Record<string, unknown>) {
  respondWithRows([row]);
}

const uri = (qid: string) => ({ type: 'uri', value: `http://www.wikidata.org/entity/${qid}` });
const literal = (value: string) => ({ type: 'literal', value });

afterEach(() => vi.unstubAllGlobals());

describe('fetchBuildingDetail rows', () => {
  it('merges rows that each bind a single property', async () => {
    respondWithRows([
      { itemAltLabel: { ...literal('Müllerhof'), 'xml:lang': 'de' } },
      {
        demolishedTime: literal('1944-01-01T00:00:00Z'),
        demolishedPrec: literal('9'),
        demolishedCal: uri('Q1985727'),
      },
      { occupant: uri('Q10'), occupantLabel: literal('Anna') },
      { occupant: uri('Q11'), occupantLabel: literal('Bernd') },
      { owner: uri('Q12'), ownerLabel: literal('Carla') },
      { address: literal('Hauptstraße 1') },
      { architect: uri('Q13'), architectLabel: literal('Dora') },
      { govId: literal('object_123') },
      { modified: literal('2026-01-01T00:00:00Z') },
    ]);
    const detail = await fetchBuildingDetail('Q1');
    expect(detail.aliases).toEqual(['Müllerhof']);
    expect(detail.demolished?.value?.time).toBe('1944-01-01T00:00:00Z');
    expect(detail.occupants.map(p => p.label)).toEqual(['Anna', 'Bernd']);
    expect(detail.owners.map(p => p.label)).toEqual(['Carla']);
    expect(detail.addresses.map(a => a.text)).toEqual(['Hauptstraße 1']);
    expect(detail.architects).toEqual([{ id: 'Q13', label: 'Dora' }]);
    expect(detail.govId).toBe('object_123');
    expect(detail.modified).toBe('2026-01-01T00:00:00Z');
    expect(detail.commissionedBy).toEqual([]);
  });

  it('returns an empty detail when there are no rows', async () => {
    respondWithRows([]);
    const detail = await fetchBuildingDetail('Q1');
    expect(detail).toEqual({
      demolished: undefined,
      aliases: [],
      aliasesLang: undefined,
      ohmId: undefined,
      govId: undefined,
      wikiTreeId: undefined,
      genWikiId: undefined,
      modified: undefined,
      heritages: [],
      images: [],
      architects: [],
      commissionedBy: [],
      occupants: [],
      owners: [],
      addresses: [],
      replacedBy: [],
      replaces: [],
    });
  });
});

describe('fetchBuildingDetail person links', () => {
  it('lists the external resources a person has, open data first', async () => {
    respondWith({
      occupant: uri('Q10'),
      occupantLabel: literal('Anna'),
      occupantWikiTree: literal('Müller-1'),
      occupantGenWiki: literal('4711'),
    });
    const detail = await fetchBuildingDetail('Q1');
    expect(detail.occupants[0].links).toEqual([
      { label: 'GenWiki', url: 'https://wiki.genealogy.net/?curid=4711' },
      { label: 'WikiTree', url: 'https://www.wikitree.com/wiki/Müller-1' },
    ]);
  });

  it('leaves links unset for a person with no external resources', async () => {
    respondWith({ owner: uri('Q12'), ownerLabel: literal('Carla') });
    const detail = await fetchBuildingDetail('Q1');
    expect(detail.owners[0].links).toBeUndefined();
  });
});

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
