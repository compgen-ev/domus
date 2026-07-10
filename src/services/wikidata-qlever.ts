import type { WikidataBuilding, WikidataItem, BuildingDetail, PersonRef, AddressEntry, WikidataTime, StatementDate } from '../types/building';
import { statementDateFromTimeString, PROLEPTIC_GREGORIAN } from '../utils/dates';
import { getLocale } from '../locale';
import { BUILDING_TYPE_SET } from './building-types';

/**
 * QLever's public Wikidata mirror (run by the University of Freiburg, not
 * Wikimedia). Faster and closer to real-time than query.wikidata.org, but
 * doesn't implement Blazegraph's `SERVICE wikibase:*` extensions — those are
 * rewritten below as plain triple patterns / GeoSPARQL filters.
 */
const SPARQL_ENDPOINT = 'https://qlever.dev/api/wikidata';

interface SparqlBinding {
  value: string;
  type: string;
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

/**
 * Generates an OPTIONAL+FILTER(lang())+COALESCE fragment that mimics
 * Blazegraph's `SERVICE wikibase:label` language-fallback priority, since
 * QLever doesn't support that SERVICE (it 404s trying to federate to the
 * literal wikiba.se IRI).
 */
function labelClause(entityExpr: string, prop: string, labelVar: string, langs: string[]): string {
  const optionals = langs
    .map((l, i) => `  OPTIONAL { ${entityExpr} ${prop} ?${labelVar}_${i} . FILTER(lang(?${labelVar}_${i}) = "${l}") }`)
    .join('\n');
  const coalesce = langs.map((_, i) => `?${labelVar}_${i}`).join(', ');
  return `${optionals}\n  BIND(COALESCE(${coalesce}) AS ?${labelVar})`;
}

function langList(langs: string): string[] {
  return langs.split(',');
}

function buildQuery(west: number, south: number, east: number, north: number): string {
  const locale = getLocale();
  const fallback = locale === 'en' ? 'de' : 'en';
  const langs = langList(`${locale},${fallback},mul`);
  return `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
SELECT ?item ?itemLabel ?type ?typeLabel ?coord ?image ?inception ?modified WHERE {
  ?item wdt:P625 ?coord .
  FILTER(geof:longitude(?coord) > ${west} && geof:longitude(?coord) < ${east} &&
         geof:latitude(?coord) > ${south} && geof:latitude(?coord) < ${north})
  ?item wdt:P31 ?type .
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item schema:dateModified ?modified . }
${labelClause('?item', 'rdfs:label', 'itemLabel', langs)}
${labelClause('?type', 'rdfs:label', 'typeLabel', langs)}
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

function timeValueClause(subject: string, path: string, v: string): string {
  return `OPTIONAL {
      ${subject} ${path} [
        wikibase:timeValue ?${v}Time ;
        wikibase:timePrecision ?${v}Prec ;
        wikibase:timeCalendarModel ?${v}Cal
      ] .
    }`;
}

function timeValueVars(v: string): string {
  return `?${v}Time ?${v}Prec ?${v}Cal`;
}

/**
 * `wikibase:BestRank`, `psv:`/`pqv:` full-value predicates and
 * `wikibase:timeValue`/`timePrecision`/`timeCalendarModel` are plain indexed
 * triples in QLever's Wikidata dump (not a Blazegraph SERVICE), so this
 * pattern is unchanged from wikidata.ts.
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
    throw new Error(`QLever SPARQL error: ${response.status}`);
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

function assertQid(id: string): void {
  if (!/^Q\d+$/.test(id)) throw new Error(`Invalid QID: ${id}`);
}

/**
 * QLever's query planner doesn't push a `BIND(wd:Qxxx AS ?item)` (or even a
 * `VALUES` clause) into join ordering the way it does a literal IRI in
 * triple position: on this file's queries `BIND` took ~9s and `VALUES` ~2.5s
 * per statement-heavy OPTIONAL block, vs ~50ms substituting the IRI
 * directly. So the query is built with `?item` for readability and the
 * variable is substituted away afterwards.
 */
function bindItem(query: string, id: string): string {
  assertQid(id);
  return query
    .replace(`BIND(wd:${id} AS ?item)\n`, '')
    .replace(/\?item\b/g, `wd:${id}`);
}

function buildDetailQuery(id: string, langs: string): string {
  const langArr = langList(langs);
  const query = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT ${timeStatementVars('demolished')} ?heritage ?heritageLabel
  ?image
  ?occupant ?occupantLabel ${timeValueVars('occupStart')} ${timeValueVars('occupEnd')}
  ?owner ?ownerLabel ${timeValueVars('ownerStart')} ${timeValueVars('ownerEnd')}
  ?address ${timeValueVars('addrStart')} ${timeValueVars('addrEnd')}
  ?architect ?architectLabel
  ?commissioned ?commissionedLabel
  ?replacedBy ?replacedByLabel
  ?replaces ?replacesLabel
  ?ohmId ?govId
  ?modified
WHERE {
  BIND(wd:${id} AS ?item)
${timeStatementPattern('P576', 'demolished')}
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL {
    ?item p:P1435 ?hStmt .
    ?hStmt ps:P1435 ?heritage .
${labelClause('?heritage', 'rdfs:label', 'heritageLabel', langArr)}
  }
  OPTIONAL {
    ?item p:P466 ?occStmt .
    ?occStmt ps:P466 ?occupant .
    ${timeValueClause('?occStmt', 'pqv:P580', 'occupStart')}
    ${timeValueClause('?occStmt', 'pqv:P582', 'occupEnd')}
${labelClause('?occupant', 'rdfs:label', 'occupantLabel', langArr)}
  }
  OPTIONAL {
    ?item p:P127 ?ownStmt .
    ?ownStmt ps:P127 ?owner .
    ${timeValueClause('?ownStmt', 'pqv:P580', 'ownerStart')}
    ${timeValueClause('?ownStmt', 'pqv:P582', 'ownerEnd')}
${labelClause('?owner', 'rdfs:label', 'ownerLabel', langArr)}
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
${labelClause('?architect', 'rdfs:label', 'architectLabel', langArr)}
  }
  OPTIONAL {
    ?item p:P88 ?commStmt .
    ?commStmt ps:P88 ?commissioned .
${labelClause('?commissioned', 'rdfs:label', 'commissionedLabel', langArr)}
  }
  OPTIONAL {
    ?item wdt:P167 ?replacedBy .
${labelClause('?replacedBy', 'rdfs:label', 'replacedByLabel', langArr)}
  }
  OPTIONAL {
    ?item wdt:P1398 ?replaces .
${labelClause('?replaces', 'rdfs:label', 'replacesLabel', langArr)}
  }
  OPTIONAL { ?item wdt:P8424 ?ohmId . }
  OPTIONAL { ?item wdt:P2503 ?govId . }
  OPTIONAL { ?item schema:dateModified ?modified . }
}`;
  return bindItem(query, id);
}

interface DetailBinding extends TimeStatementBindings {
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
  modified?: SparqlBinding;
}

export async function fetchBuildingById(
  id: string,
  signal?: AbortSignal,
): Promise<WikidataBuilding | null> {
  const locale = getLocale();
  const fallback = locale === 'en' ? 'de' : 'en';
  const langs = `${locale},${fallback},mul`;
  const langArr = langList(langs);

  const rawQuery = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT ?itemLabel ?type ?typeLabel ?coord ?image ${timeStatementVars('inception')} ?modified WHERE {
  BIND(wd:${id} AS ?item)
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P31 ?type . }
  OPTIONAL { ?item wdt:P18 ?image . }
${timeStatementPattern('P571', 'inception')}
  OPTIONAL { ?item schema:dateModified ?modified . }
${labelClause('?item', 'rdfs:label', 'itemLabel', langArr)}
${labelClause('?type', 'rdfs:label', 'typeLabel', langArr)}
}
LIMIT 1`;
  const query = bindItem(rawQuery, id);

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

  if (!response.ok) throw new Error(`QLever SPARQL error: ${response.status}`);

  const data: { results: { bindings: DetailBinding[] } } = await response.json();
  const rows = data.results.bindings;

  let demolished: StatementDate | undefined;
  let ohmId: string | undefined;
  let govId: string | undefined;
  let modified: string | undefined;
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
    if (row.modified && !modified) modified = row.modified.value;
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
    ohmId,
    govId,
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
