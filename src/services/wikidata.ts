import type { WikidataBuilding, WikidataItem, BuildingDetail, PersonRef, AddressEntry, ExternalLink, WikidataTime, StatementDate } from '../types/building';
import { statementDateFromTimeString, PROLEPTIC_GREGORIAN } from '../utils/dates';
import { getLocale } from '../locale';
import { BUILDING_TYPE_SET } from './building-type-set';

/** The QLever-backed query service, which replaces Blazegraph at query.wikidata.org. */
const SPARQL_ENDPOINT = 'https://query-next.wikidata.org/sparql';

interface SparqlBinding {
  value: string;
  type: string;
  'xml:lang'?: string;
}

/**
 * Runs a query and returns its result rows. Sent as a form-encoded POST: the
 * detail query is longer than the endpoint accepts in a GET URL (HTTP 414),
 * POST responses are never served from an HTTP cache, so a query right after
 * an edit sees the current data, and a form body keeps this a CORS simple
 * request without a preflight.
 */
async function runQuery<T>(query: string, signal?: AbortSignal): Promise<T[]> {
  const response = await fetch(SPARQL_ENDPOINT, {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json' },
    body: new URLSearchParams({ query }),
    signal,
  });
  if (!response.ok) throw new Error(`Wikidata SPARQL error: ${response.status}`);
  const data: { results: { bindings: T[] } } = await response.json();
  return data.results.bindings;
}

interface BuildingBinding {
  item?: SparqlBinding;
  itemLabel?: SparqlBinding;
  type?: SparqlBinding;
  typeLabel?: SparqlBinding;
  coord?: SparqlBinding;
  image?: SparqlBinding;
  inception?: SparqlBinding;
  modified?: SparqlBinding;
}

function buildQuery(west: number, south: number, east: number, north: number): string {
  const langs = labelLanguages().join(',');
  // geof:sfWithin against a constant polygon is answered from QLever's
  // spatial index; a FILTER on geof:latitude/geof:longitude scans every
  // coordinate and runs into the 60 s timeout. Points exactly on the box
  // edge are not "within" and drop out, which a map viewport can afford.
  const box = `POLYGON((${west} ${south}, ${east} ${south}, ${east} ${north}, ${west} ${north}, ${west} ${south}))`;
  return `
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
SELECT ?item ?itemLabel ?type ?typeLabel ?coord ?image ?inception ?modified WHERE {
  ?item wdt:P625 ?coord .
  FILTER geof:sfWithin(?coord, "${box}"^^geo:wktLiteral)
  ?item wdt:P31 ?type .
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item schema:dateModified ?modified . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${langs}" . }
}
LIMIT 5000`;
}

function parseCoord(wkt: string): { lat: number; lng: number } | null {
  // WKT format: "POINT(lng lat)"; the keyword is case-insensitive.
  const match = wkt.match(/point\s*\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)/i);
  if (!match) return null;
  return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
}

function extractQid(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

function toWikidataTime(
  time?: SparqlBinding,
  prec?: SparqlBinding,
  cal?: SparqlBinding,
): WikidataTime | undefined {
  if (!time?.value) return undefined;
  return {
    time: time.value,
    precision: prec ? parseInt(prec.value, 10) : 9,
    calendarmodel: cal?.value ?? PROLEPTIC_GREGORIAN,
  };
}

function toStatementDate(
  value?: WikidataTime,
  earliest?: WikidataTime,
  latest?: WikidataTime,
): StatementDate | undefined {
  if (!value && !earliest && !latest) return undefined;
  return { value, earliest, latest };
}

/** Label languages in order of preference: the UI locale, the other UI language, then mul. */
function labelLanguages(): string[] {
  const locale = getLocale();
  return [locale, locale === 'en' ? 'de' : 'en', 'mul'];
}

/**
 * Binds ?<v>Label to the label of `term` in the first of `langs` that has
 * one, leaving it unbound if none does. Placed next to the pattern that
 * binds `term`: the label service would instead look labels up for every
 * projected ?…Label variable across all rows, which costs seconds on the
 * QLever query service.
 */
function labelClauses(term: string, v: string, langs: string[]): string {
  const candidates = langs.map((_, i) => `?${v}Label${i}`);
  return [
    ...langs.map((lang, i) =>
      `OPTIONAL { ${term} rdfs:label ${candidates[i]} . FILTER(LANG(${candidates[i]}) = "${lang}") }`),
    `BIND(COALESCE(${candidates.join(', ')}) AS ?${v}Label)`,
  ].join('\n    ');
}

/**
 * SPARQL OPTIONAL binding a full time value node (via psv:/pqv:, which
 * carry authoritative precision and calendar model) into ?<v>Time,
 * ?<v>Prec and ?<v>Cal.
 *
 * `anchor` is the triple that binds `subject`, repeated inside the OPTIONAL.
 * QLever evaluates an OPTIONAL's inside on its own before joining it, so
 * without the anchor it would collect the time values of every statement in
 * Wikidata first.
 */
function timeValueClause(anchor: string, subject: string, path: string, v: string): string {
  return `OPTIONAL {
      ${anchor}
      ${subject} ${path} [
        wikibase:timeValue ?${v}Time ;
        wikibase:timePrecision ?${v}Prec ;
        wikibase:timeCalendarModel ?${v}Cal
      ] .
    }`;
}

/** The three SELECT variables produced by {@link timeValueClause}. */
function timeValueVars(v: string): string {
  return `?${v}Time ?${v}Prec ?${v}Cal`;
}

/**
 * SPARQL triples binding a time property's statement value plus its
 * P1319 (earliest) / P1326 (latest) qualifiers. Matches only items that
 * have such a statement; see {@link timeStatementPattern} for the
 * optional form.
 *
 * Goes through p:/psv: (not wdt:) so unknown-value statements — where
 * only the qualifiers exist — are still matched. Restricted to best-rank
 * statements to mirror wdt: truthy semantics.
 */
function timeStatementClauses(item: string, prop: string, v: string): string {
  const stmt = `?${v}Stmt`;
  const anchor = `${item} p:${prop} ${stmt} .`;
  return `
    ${anchor}
    ${stmt} a wikibase:BestRank .
    ${timeValueClause(anchor, stmt, `psv:${prop}`, v)}
    ${timeValueClause(anchor, stmt, 'pqv:P1319', `${v}Earliest`)}
    ${timeValueClause(anchor, stmt, 'pqv:P1326', `${v}Latest`)}`;
}

/** {@link timeStatementClauses} wrapped in OPTIONAL. */
function timeStatementPattern(item: string, prop: string, v: string): string {
  return `
  OPTIONAL {${timeStatementClauses(item, prop, v)}
  }`;
}

/** The nine SELECT variables produced by {@link timeStatementPattern}. */
function timeStatementVars(v: string): string {
  return `${timeValueVars(v)} ${timeValueVars(`${v}Earliest`)} ${timeValueVars(`${v}Latest`)}`;
}

interface TimeStatementBindings {
  [key: string]: SparqlBinding | undefined;
}

/**
 * External resources listed for a person, in display order: the identifier
 * property, the label shown in the UI and the URL its value expands to.
 * Wikidata itself is not in here — the person's name already links there.
 */
const PERSON_LINK_SOURCES = [
  { suffix: 'GenWiki', prop: 'P14871', label: 'GenWiki', url: (id: string) => `https://wiki.genealogy.net/?curid=${id}` },
  { suffix: 'WikiTree', prop: 'P2949', label: 'WikiTree', url: (id: string) => `https://www.wikitree.com/wiki/${id}` },
] as const;

/** OPTIONAL clauses binding every {@link PERSON_LINK_SOURCES} id of `v`. */
function personLinkClauses(v: string): string {
  return PERSON_LINK_SOURCES
    .map(({ suffix, prop }) => `OPTIONAL { ?${v} wdt:${prop} ?${v}${suffix} . }`)
    .join('\n    ');
}

/** The SELECT variables produced by {@link personLinkClauses}. */
function personLinkVars(v: string): string {
  return PERSON_LINK_SOURCES.map(({ suffix }) => `?${v}${suffix}`).join(' ');
}

function parsePersonLinks(row: TimeStatementBindings, v: string): ExternalLink[] | undefined {
  const links = PERSON_LINK_SOURCES.flatMap(({ suffix, label, url }) => {
    const value = row[`${v}${suffix}`]?.value;
    return value ? [{ label, url: url(value) }] : [];
  });
  return links.length > 0 ? links : undefined;
}

function parseTimeValue(row: TimeStatementBindings, v: string): WikidataTime | undefined {
  return toWikidataTime(row[`${v}Time`], row[`${v}Prec`], row[`${v}Cal`]);
}

function parseTimeStatement(row: TimeStatementBindings, v: string): StatementDate | undefined {
  return toStatementDate(
    parseTimeValue(row, v),
    parseTimeValue(row, `${v}Earliest`),
    parseTimeValue(row, `${v}Latest`),
  );
}

export async function fetchBuildings(
  west: number,
  south: number,
  east: number,
  north: number,
  signal?: AbortSignal,
): Promise<WikidataBuilding[]> {
  const rows = await runQuery<BuildingBinding>(buildQuery(west, south, east, north), signal);
  const seen = new Set<string>();
  const buildings: WikidataBuilding[] = [];

  for (const row of rows) {
    if (!row.item || !row.coord) continue;

    const id = extractQid(row.item.value);
    if (seen.has(id)) continue;

    const coords = parseCoord(row.coord.value);
    if (!coords) continue;

    // Client-side filtering: only include buildings
    const typeId = row.type?.value ? extractQid(row.type.value) : null;
    if (!typeId || !BUILDING_TYPE_SET.has(typeId)) continue;

    seen.add(id);
    buildings.push({
      id,
      label: row.itemLabel?.value ?? id,
      type: row.type?.value && row.typeLabel?.value
        ? { id: typeId, label: row.typeLabel.value }
        : undefined,
      lat: coords.lat,
      lng: coords.lng,
      image: row.image?.value,
      inception: row.inception?.value
        ? statementDateFromTimeString(row.inception.value)
        : undefined,
      modified: row.modified?.value,
    });
  }

  return buildings;
}

/**
 * Every property sits in its own UNION branch, so each result row binds the
 * variables of exactly one property and the row count is the sum of the
 * value counts rather than their product. Aliases come one per row, in every
 * language of the fallback chain; the caller picks the language.
 *
 * The item IRI is written into each pattern rather than bound to ?item once:
 * QLever plans a bound variable like an unknown one and works through the
 * matching statements of all items, which takes about 20 s instead of 1 s.
 */
function buildDetailQuery(id: string, langs: string[]): string {
  const item = `wd:${id}`;
  const occ = `${item} p:P466 ?occStmt .`;
  const own = `${item} p:P127 ?ownStmt .`;
  const addr = `${item} p:P6375 ?addrStmt .`;
  return `
SELECT ?alias ${timeStatementVars('demolished')} ?heritage ?heritageLabel
  ?image
  ?occupant ?occupantLabel ${timeValueVars('occupStart')} ${timeValueVars('occupEnd')}
  ${personLinkVars('occupant')}
  ?owner ?ownerLabel ${timeValueVars('ownerStart')} ${timeValueVars('ownerEnd')}
  ${personLinkVars('owner')}
  ?address ${timeValueVars('addrStart')} ${timeValueVars('addrEnd')}
  ?architect ?architectLabel
  ${personLinkVars('architect')}
  ?commissioned ?commissionedLabel
  ${personLinkVars('commissioned')}
  ?replacedBy ?replacedByLabel
  ?replaces ?replacesLabel
  ?ohmId ?govId ?wikiTreeId ?genWikiId
  ?modified
WHERE {
  {
    ${item} skos:altLabel ?alias .
    FILTER(LANG(?alias) IN (${langs.map((l) => `"${l}"`).join(', ')}))
  } UNION {${timeStatementClauses(item, 'P576', 'demolished')}
  } UNION {
    ${item} wdt:P18 ?image .
  } UNION {
    ${item} p:P1435 ?hStmt .
    ?hStmt ps:P1435 ?heritage .
    ${labelClauses('?heritage', 'heritage', langs)}
  } UNION {
    ${occ}
    ?occStmt ps:P466 ?occupant .
    ${timeValueClause(occ, '?occStmt', 'pqv:P580', 'occupStart')}
    ${timeValueClause(occ, '?occStmt', 'pqv:P582', 'occupEnd')}
    ${personLinkClauses('occupant')}
    ${labelClauses('?occupant', 'occupant', langs)}
  } UNION {
    ${own}
    ?ownStmt ps:P127 ?owner .
    ${timeValueClause(own, '?ownStmt', 'pqv:P580', 'ownerStart')}
    ${timeValueClause(own, '?ownStmt', 'pqv:P582', 'ownerEnd')}
    ${personLinkClauses('owner')}
    ${labelClauses('?owner', 'owner', langs)}
  } UNION {
    ${addr}
    ?addrStmt ps:P6375 ?address .
    ${timeValueClause(addr, '?addrStmt', 'pqv:P580', 'addrStart')}
    ${timeValueClause(addr, '?addrStmt', 'pqv:P582', 'addrEnd')}
  } UNION {
    ${item} p:P84 ?archStmt .
    ?archStmt ps:P84 ?architect .
    ${personLinkClauses('architect')}
    ${labelClauses('?architect', 'architect', langs)}
  } UNION {
    ${item} p:P88 ?commStmt .
    ?commStmt ps:P88 ?commissioned .
    ${personLinkClauses('commissioned')}
    ${labelClauses('?commissioned', 'commissioned', langs)}
  } UNION {
    ${item} wdt:P167 ?replacedBy .
    ${labelClauses('?replacedBy', 'replacedBy', langs)}
  } UNION {
    ${item} wdt:P1398 ?replaces .
    ${labelClauses('?replaces', 'replaces', langs)}
  } UNION {
    ${item} wdt:P8424 ?ohmId .
  } UNION {
    ${item} wdt:P2503 ?govId .
  } UNION {
    ${item} wdt:P7607 ?wikiTreeId .
  } UNION {
    ${item} wdt:P14871 ?genWikiId .
  } UNION {
    ${item} schema:dateModified ?modified .
  }
}`;
}

interface DetailBinding extends TimeStatementBindings {
  alias?: SparqlBinding;
  heritage?: SparqlBinding;
  heritageLabel?: SparqlBinding;
  image?: SparqlBinding;
  occupant?: SparqlBinding;
  occupantLabel?: SparqlBinding;
  owner?: SparqlBinding;
  ownerLabel?: SparqlBinding;
  address?: SparqlBinding;
  architect?: SparqlBinding;
  architectLabel?: SparqlBinding;
  commissioned?: SparqlBinding;
  commissionedLabel?: SparqlBinding;
  replacedBy?: SparqlBinding;
  replacedByLabel?: SparqlBinding;
  replaces?: SparqlBinding;
  replacesLabel?: SparqlBinding;
  ohmId?: SparqlBinding;
  govId?: SparqlBinding;
  wikiTreeId?: SparqlBinding;
  genWikiId?: SparqlBinding;
  modified?: SparqlBinding;
}

export async function fetchBuildingById(
  id: string,
  signal?: AbortSignal,
): Promise<WikidataBuilding | null> {
  const langs = labelLanguages();
  // The item IRI is written into each pattern for the reason given at
  // buildDetailQuery; here it saves about 2.5 s.
  const item = `wd:${id}`;
  const query = `
SELECT ?itemLabel ?type ?typeLabel ?coord ?image ${timeStatementVars('inception')} ?modified WHERE {
  OPTIONAL { ${item} wdt:P625 ?coord . }
  OPTIONAL {
    ${item} wdt:P31 ?type .
    ${labelClauses('?type', 'type', langs)}
  }
  OPTIONAL { ${item} wdt:P18 ?image . }
${timeStatementPattern(item, 'P571', 'inception')}
  OPTIONAL { ${item} schema:dateModified ?modified . }
  ${labelClauses(item, 'item', langs)}
}
LIMIT 1`;

  interface SingleBuildingBinding extends TimeStatementBindings {
    itemLabel?: SparqlBinding;
    type?: SparqlBinding;
    typeLabel?: SparqlBinding;
    coord?: SparqlBinding;
    image?: SparqlBinding;
    modified?: SparqlBinding;
  }
  const [row] = await runQuery<SingleBuildingBinding>(query, signal);
  if (!row) return null;

  const coords = row.coord ? parseCoord(row.coord.value) : null;
  if (!coords) return null;

  const inception = parseTimeStatement(row, 'inception');

  return {
    id,
    label: row.itemLabel?.value ?? id,
    type: row.type?.value
      ? { id: extractQid(row.type.value), label: row.typeLabel?.value ?? extractQid(row.type.value) }
      : undefined,
    lat: coords.lat,
    lng: coords.lng,
    image: row.image?.value,
    inception,
    modified: row.modified?.value,
  };
}

export async function fetchBuildingDetail(
  id: string,
  signal?: AbortSignal,
): Promise<BuildingDetail> {
  const langs = labelLanguages();
  const rows = await runQuery<DetailBinding>(buildDetailQuery(id, langs), signal);

  let demolished: StatementDate | undefined;
  let ohmId: string | undefined;
  let govId: string | undefined;
  let wikiTreeId: string | undefined;
  let genWikiId: string | undefined;
  let modified: string | undefined;
  const aliasesByLang = new Map<string, string[]>();
  const heritageSet = new Set<string>();
  const imageSet = new Set<string>();
  const occupants = new Map<string, PersonRef>();
  const owners = new Map<string, PersonRef>();
  const addresses = new Map<string, AddressEntry>();
  const architects = new Map<string, PersonRef>();
  const commissionedBy = new Map<string, PersonRef>();
  const replacedByMap = new Map<string, WikidataItem>();
  const replacesMap = new Map<string, WikidataItem>();

  for (const row of rows) {
    if (!demolished) demolished = parseTimeStatement(row, 'demolished');
    if (row.ohmId && !ohmId) ohmId = row.ohmId.value;
    if (row.govId && !govId) govId = row.govId.value;
    if (row.wikiTreeId && !wikiTreeId) wikiTreeId = row.wikiTreeId.value;
    if (row.genWikiId && !genWikiId) genWikiId = row.genWikiId.value;
    if (row.modified && !modified) modified = row.modified.value;
    if (row.alias) {
      const lang = row.alias['xml:lang'] ?? '';
      const list = aliasesByLang.get(lang) ?? [];
      if (!list.includes(row.alias.value)) list.push(row.alias.value);
      aliasesByLang.set(lang, list);
    }
    if (row.heritage) heritageSet.add(row.heritageLabel?.value ?? extractQid(row.heritage.value));
    if (row.image) imageSet.add(row.image.value);

    if (row.occupant) {
      const start = parseTimeValue(row, 'occupStart');
      const end = parseTimeValue(row, 'occupEnd');
      const key = `${row.occupant.value}|${start?.time ?? ''}|${end?.time ?? ''}`;
      if (!occupants.has(key)) {
        occupants.set(key, {
          id: extractQid(row.occupant.value),
          label: row.occupantLabel?.value ?? extractQid(row.occupant.value),
          start,
          end,
          links: parsePersonLinks(row, 'occupant'),
        });
      }
    }

    if (row.owner) {
      const start = parseTimeValue(row, 'ownerStart');
      const end = parseTimeValue(row, 'ownerEnd');
      const key = `${row.owner.value}|${start?.time ?? ''}|${end?.time ?? ''}`;
      if (!owners.has(key)) {
        owners.set(key, {
          id: extractQid(row.owner.value),
          label: row.ownerLabel?.value ?? extractQid(row.owner.value),
          start,
          end,
          links: parsePersonLinks(row, 'owner'),
        });
      }
    }

    if (row.address) {
      const start = parseTimeValue(row, 'addrStart');
      const end = parseTimeValue(row, 'addrEnd');
      const key = `${row.address.value}|${start?.time ?? ''}|${end?.time ?? ''}`;
      if (!addresses.has(key)) {
        addresses.set(key, {
          text: row.address.value,
          language: row.address['xml:lang'],
          start,
          end,
        });
      }
    }

    if (row.architect) {
      const key = row.architect.value;
      if (!architects.has(key)) {
        architects.set(key, {
          id: extractQid(row.architect.value),
          label: row.architectLabel?.value ?? extractQid(row.architect.value),
          links: parsePersonLinks(row, 'architect'),
        });
      }
    }

    if (row.commissioned) {
      const key = row.commissioned.value;
      if (!commissionedBy.has(key)) {
        commissionedBy.set(key, {
          id: extractQid(row.commissioned.value),
          label: row.commissionedLabel?.value ?? extractQid(row.commissioned.value),
          links: parsePersonLinks(row, 'commissioned'),
        });
      }
    }

    if (row.replacedBy) {
      const key = row.replacedBy.value;
      if (!replacedByMap.has(key)) {
        replacedByMap.set(key, {
          id: extractQid(key),
          label: row.replacedByLabel?.value ?? extractQid(key),
        });
      }
    }

    if (row.replaces) {
      const key = row.replaces.value;
      if (!replacesMap.has(key)) {
        replacesMap.set(key, {
          id: extractQid(key),
          label: row.replacesLabel?.value ?? extractQid(key),
        });
      }
    }
  }

  // Like the item's label, its aliases come from the first language of the
  // fallback chain that has any, and that language is reported alongside.
  const aliasesLang = langs.find((lang) => aliasesByLang.has(lang));
  const aliases = aliasesLang ? aliasesByLang.get(aliasesLang)! : [];

  const byStart = (a: { start?: WikidataTime }, b: { start?: WikidataTime }) => {
    if (!a.start && !b.start) return 0;
    if (!a.start) return 1;
    if (!b.start) return -1;
    return a.start.time < b.start.time ? -1 : 1;
  };

  return {
    demolished,
    aliases,
    aliasesLang,
    ohmId,
    govId,
    wikiTreeId,
    genWikiId,
    modified,
    heritages: [...heritageSet],
    images: [...imageSet],
    architects: [...architects.values()],
    commissionedBy: [...commissionedBy.values()],
    occupants: [...occupants.values()].sort(byStart),
    owners: [...owners.values()].sort(byStart),
    addresses: [...addresses.values()].sort(byStart),
    replacedBy: [...replacedByMap.values()],
    replaces: [...replacesMap.values()],
  };
}

export async function fetchDepictingPhotos(
  id: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `haswbstatement:P180=${id}`,
    gsrlimit: '50',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '400',
    format: 'json',
    origin: '*',
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal });
  if (!response.ok) throw new Error(`Commons API error: ${response.status}`);

  const data: {
    query?: { pages?: Record<string, { imageinfo?: Array<{ url: string; thumburl?: string }> }> };
  } = await response.json();
  const pages = data.query?.pages ?? {};
  return Object.values(pages)
    .map((p) => p.imageinfo?.[0]?.thumburl ?? p.imageinfo?.[0]?.url)
    .filter((v): v is string => !!v);
}

export function buildingsToGeoJSON(
  buildings: WikidataBuilding[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: buildings.map((b) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
      properties: {
        id: b.id,
        label: b.label,
        typeId: b.type?.id ?? null,
        typeLabel: b.type?.label ?? null,
        image: b.image ?? null,
        // GeoJSON properties must be flat — store only the time string.
        // map-view reconstructs it via statementDateFromTimeString; the
        // authoritative StatementDate is refetched on selection.
        inception: b.inception?.value?.time ?? null,
      },
    })),
  };
}
