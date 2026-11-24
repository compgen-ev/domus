import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchBuildings, fetchBuildingById, fetchBuildingDetail } from './wikidata';
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
      { alias: { ...literal('Müllerhof'), 'xml:lang': getLocale() } },
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
  const alias = (value: string, lang: string) => ({ alias: { type: 'literal', 'xml:lang': lang, value } });
  const other = getLocale() === 'en' ? 'de' : 'en';

  it('takes the aliases of the first language in the fallback chain that has any', async () => {
    respondWithRows([
      alias('Old Smithy', other),
      alias('Müllerhof', getLocale()),
      alias('Alte Schmiede', getLocale()),
      alias('Douglas N. Adams', 'mul'),
    ]);
    const detail = await fetchBuildingDetail('Q1');
    expect(detail.aliases).toEqual(['Müllerhof', 'Alte Schmiede']);
    expect(detail.aliasesLang).toBe(getLocale());
  });

  it('reports the language the fallback chain settled on', async () => {
    respondWithRows([alias('Douglas N. Adams', 'mul')]);
    const detail = await fetchBuildingDetail('Q1');
    expect(detail.aliases).toEqual(['Douglas N. Adams']);
    expect(detail.aliasesLang).toBe('mul');
  });

  it('keeps an alias containing a comma whole and drops repeats', async () => {
    respondWithRows([
      alias('Liebfrauendom, München', getLocale()),
      alias('Liebfrauendom, München', getLocale()),
    ]);
    const detail = await fetchBuildingDetail('Q1');
    expect(detail.aliases).toEqual(['Liebfrauendom, München']);
  });

  it('reports no aliases and no language when the item has none', async () => {
    respondWith({});
    const detail = await fetchBuildingDetail('Q1');
    expect(detail.aliases).toEqual([]);
    expect(detail.aliasesLang).toBeUndefined();
  });
});

describe('labels missing in every fallback language', () => {
  it('shows a heritage designation by its QID', async () => {
    respondWith({ heritage: uri('Q17297633') });
    const detail = await fetchBuildingDetail('Q1');
    expect(detail.heritages).toEqual(['Q17297633']);
  });

  it('keeps the type, labelled by its QID', async () => {
    respondWith({ coord: literal('POINT(11.5 48.1)'), type: uri('Q41176') });
    const building = await fetchBuildingById('Q1');
    expect(building?.type).toEqual({ id: 'Q41176', label: 'Q41176' });
    expect(building?.label).toBe('Q1');
  });
});

describe('item queries', () => {
  /** The query text each call sends. */
  async function sentQueries(call: () => Promise<unknown>): Promise<string> {
    let query = '';
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      query = (init.body as URLSearchParams).get('query')!;
      return { ok: true, json: async () => ({ results: { bindings: [] } }) };
    });
    await call();
    return query;
  }

  // Binding the item to ?item, or using the label service, makes the QLever
  // query service take seconds instead of fractions of one.
  it.each([
    ['fetchBuildingById', () => fetchBuildingById('Q42')],
    ['fetchBuildingDetail', () => fetchBuildingDetail('Q42')],
  ])('%s writes the item IRI into its patterns', async (_name, call) => {
    const query = await sentQueries(call);
    expect(query).toContain('wd:Q42 ');
    expect(query).not.toMatch(/\?item\b(?!Label)/);
    expect(query).not.toContain('SERVICE wikibase:label');
  });

  it('repeats the statement inside the OPTIONALs that hang off it', async () => {
    const query = await sentQueries(() => fetchBuildingDetail('Q42'));
    // Once to bind the statement, once in each of the two date OPTIONALs.
    expect(query.split('wd:Q42 p:P466 ?occStmt .').length - 1).toBe(3);
  });
});

describe('fetchBuildings', () => {
  it('reads upper-case WKT points', async () => {
    respondWith({
      item: uri('Q1'),
      itemLabel: literal('Haus'),
      type: uri('Q41176'),
      typeLabel: literal('Gebäude'),
      coord: { type: 'literal', value: 'POINT(11.572222 48.146944)' },
    });
    const [building] = await fetchBuildings(11, 48, 12, 49);
    expect(building).toMatchObject({ id: 'Q1', lat: 48.146944, lng: 11.572222 });
  });

  it('posts the query form-encoded', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ results: { bindings: [] } }) }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchBuildings(11, 48, 12, 49);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.body as URLSearchParams).get('query')).toContain('geof:sfWithin');
  });
});
