import type { WikidataBuilding, WikidataItem, BuildingDetail, PersonRef, AddressEntry, WikidataTime, StatementDate } from '../types/building';
import { statementDateFromTimeString, PROLEPTIC_GREGORIAN } from '../utils/dates';
import { normalizeAliases } from '../utils/aliases';
import { getLocale } from '../locale';
import { BUILDING_TYPE_SET } from './building-types';

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

interface SparqlBinding {
  value: string;
  type: string;
  'xml:lang'?: string;
}

interface SparqlResult {
  results: {
    bindings: Array<{
      item?: SparqlBinding;
      itemLabel?: SparqlBinding;
      type?: SparqlBinding;
      typeLabel?: SparqlBinding;
      coord?: SparqlBinding;
      image?: SparqlBinding;
      inception?: SparqlBinding;
      modified?: SparqlBinding;
    }>;
  };
}

function buildQuery(west: number, south: number, east: number, north: number): string {
  const locale = getLocale();
  const fallback = locale === 'en' ? 'de' : 'en';
  const langs = `${locale},${fallback},mul`;
  return `
SELECT ?item ?itemLabel ?type ?typeLabel ?coord ?image ?inception ?modified WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(${west} ${south})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(${east} ${north})"^^geo:wktLiteral .
  }
  ?item wdt:P31 ?type .
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item schema:dateModified ?modified . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${langs}" . }
}
LIMIT 5000`;
}

function parseCoord(wkt: string): { lat: number; lng: number } | null {
  // WKT format: "Point(lng lat)"
  const match = wkt.match(/Point\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)/);
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

/**
 * SPARQL OPTIONAL binding a full time value node (via psv:/pqv:, which
 * carry authoritative precision and calendar model) into ?<v>Time,
 * ?<v>Prec and ?<v>Cal.
 */
function timeValueClause(subject: string, path: string, v: string): string {
  return `OPTIONAL {
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
 * SPARQL fragment binding a time property's statement value plus its
 * P1319 (earliest) / P1326 (latest) qualifiers.
 *
 * Goes through p:/psv: (not wdt:) so unknown-value statements — where
 * only the qualifiers exist — are still matched. Restricted to best-rank
 * statements to mirror wdt: truthy semantics.
 */
function timeStatementPattern(prop: string, v: string): string {
  const stmt = `?${v}Stmt`;
  return `
  OPTIONAL {
    ?item p:${prop} ${stmt} .
    ${stmt} a wikibase:BestRank .
    ${timeValueClause(stmt, `psv:${prop}`, v)}
    ${timeValueClause(stmt, 'pqv:P1319', `${v}Earliest`)}
    ${timeValueClause(stmt, 'pqv:P1326', `${v}Latest`)}
  }`;
}

/** The nine SELECT variables produced by {@link timeStatementPattern}. */
function timeStatementVars(v: string): string {
  return `${timeValueVars(v)} ${timeValueVars(`${v}Earliest`)} ${timeValueVars(`${v}Latest`)}`;
}

interface TimeStatementBindings {
  [key: string]: SparqlBinding | undefined;
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
  const query = buildQuery(west, south, east, north);
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;

  const response = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Wikidata SPARQL error: ${response.status}`);
  }

  const data: SparqlResult = await response.json();
  const seen = new Set<string>();
  const buildings: WikidataBuilding[] = [];

  for (const row of data.results.bindings) {
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

function buildDetailQuery(id: string, langs: string): string {
  return `
SELECT ?itemAltLabel ${timeStatementVars('demolished')} ?heritage ?heritageLabel
  ?image
  ?occupant ?occupantLabel ${timeValueVars('occupStart')} ${timeValueVars('occupEnd')}
  ?owner ?ownerLabel ${timeValueVars('ownerStart')} ${timeValueVars('ownerEnd')}
  ?address ${timeValueVars('addrStart')} ${timeValueVars('addrEnd')}
  ?architect ?architectLabel
  ?commissioned ?commissionedLabel
  ?replacedBy ?replacedByLabel
  ?replaces ?replacesLabel
  ?ohmId ?govId ?wikiTreeId
  ?modified
WHERE {
  BIND(wd:${id} AS ?item)
${timeStatementPattern('P576', 'demolished')}
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL {
    ?item p:P1435 ?hStmt .
    ?hStmt ps:P1435 ?heritage .
  }
  OPTIONAL {
    ?item p:P466 ?occStmt .
    ?occStmt ps:P466 ?occupant .
    ${timeValueClause('?occStmt', 'pqv:P580', 'occupStart')}
    ${timeValueClause('?occStmt', 'pqv:P582', 'occupEnd')}
  }
  OPTIONAL {
    ?item p:P127 ?ownStmt .
    ?ownStmt ps:P127 ?owner .
    ${timeValueClause('?ownStmt', 'pqv:P580', 'ownerStart')}
    ${timeValueClause('?ownStmt', 'pqv:P582', 'ownerEnd')}
  }
  OPTIONAL {
    ?item p:P6375 ?addrStmt .
    ?addrStmt ps:P6375 ?address .
    ${timeValueClause('?addrStmt', 'pqv:P580', 'addrStart')}
    ${timeValueClause('?addrStmt', 'pqv:P582', 'addrEnd')}
  }
  OPTIONAL {
    ?item p:P84 ?archStmt .
    ?archStmt ps:P84 ?architect .
  }
  OPTIONAL {
    ?item p:P88 ?commStmt .
    ?commStmt ps:P88 ?commissioned .
  }
  OPTIONAL { ?item wdt:P167 ?replacedBy . }
  OPTIONAL { ?item wdt:P1398 ?replaces . }
  OPTIONAL { ?item wdt:P8424 ?ohmId . }
  OPTIONAL { ?item wdt:P2503 ?govId . }
  OPTIONAL { ?item wdt:P7607 ?wikiTreeId . }
  OPTIONAL { ?item schema:dateModified ?modified . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${langs}" . }
}`;
}

interface DetailBinding extends TimeStatementBindings {
  itemAltLabel?: SparqlBinding;
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
  modified?: SparqlBinding;
}

export async function fetchBuildingById(
  id: string,
  signal?: AbortSignal,
): Promise<WikidataBuilding | null> {
  const locale = getLocale();
  const fallback = locale === 'en' ? 'de' : 'en';
  const langs = `${locale},${fallback},mul`;

  const query = `
SELECT ?itemLabel ?type ?typeLabel ?coord ?image ${timeStatementVars('inception')} ?modified WHERE {
  BIND(wd:${id} AS ?item)
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P31 ?type . }
  OPTIONAL { ?item wdt:P18 ?image . }
${timeStatementPattern('P571', 'inception')}
  OPTIONAL { ?item schema:dateModified ?modified . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${langs}" . }
}
LIMIT 1`;

  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
  const response = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json' },
    signal,
  });
  if (!response.ok) throw new Error(`SPARQL error: ${response.status}`);

  interface SingleBuildingBinding extends TimeStatementBindings {
    itemLabel?: SparqlBinding;
    type?: SparqlBinding;
    typeLabel?: SparqlBinding;
    coord?: SparqlBinding;
    image?: SparqlBinding;
    modified?: SparqlBinding;
  }
  const data: { results: { bindings: SingleBuildingBinding[] } } = await response.json();
  const row = data.results.bindings[0];
  if (!row) return null;

  const coords = row.coord ? parseCoord(row.coord.value) : null;
  if (!coords) return null;

  const inception = parseTimeStatement(row, 'inception');

  return {
    id,
    label: row.itemLabel?.value ?? id,
    type: row.type?.value && row.typeLabel?.value
      ? { id: extractQid(row.type.value), label: row.typeLabel.value }
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
  const locale = getLocale();
  const fallback = locale === 'en' ? 'de' : 'en';
  const langs = `${locale},${fallback},mul`;

  const query = buildDetailQuery(id, langs);
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;

  const response = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json' },
    signal,
  });

  if (!response.ok) throw new Error(`Wikidata SPARQL error: ${response.status}`);

  const data: { results: { bindings: DetailBinding[] } } = await response.json();
  const rows = data.results.bindings;

  let demolished: StatementDate | undefined;
  let ohmId: string | undefined;
  let govId: string | undefined;
  let wikiTreeId: string | undefined;
  let modified: string | undefined;
  let aliases: string[] = [];
  let aliasesLang: string | undefined;
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
    if (row.modified && !modified) modified = row.modified.value;
    // The label service joins all aliases of one language into a single
    // comma-separated literal, the same form the edit field takes them in, and
    // tags it with the language it settled on from the fallback chain.
    if (row.itemAltLabel && aliases.length === 0) {
      aliases = normalizeAliases(row.itemAltLabel.value);
      aliasesLang = row.itemAltLabel['xml:lang'];
    }
    if (row.heritage && row.heritageLabel) heritageSet.add(row.heritageLabel.value);
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
        });
      }
    }

    if (row.commissioned) {
      const key = row.commissioned.value;
      if (!commissionedBy.has(key)) {
        commissionedBy.set(key, {
          id: extractQid(row.commissioned.value),
          label: row.commissionedLabel?.value ?? extractQid(row.commissioned.value),
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
