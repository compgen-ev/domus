import type { WikidataBuilding, BuildingDetail, PersonRef, AddressEntry } from '../types/building';
import { getLocale } from '../locale';

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

interface SparqlBinding {
  value: string;
  type: string;
}

interface SparqlResult {
  results: {
    bindings: Array<{
      item?: SparqlBinding;
      itemLabel?: SparqlBinding;
      typeLabel?: SparqlBinding;
      coord?: SparqlBinding;
      image?: SparqlBinding;
      inception?: SparqlBinding;
    }>;
  };
}

function buildQuery(west: number, south: number, east: number, north: number): string {
  const locale = getLocale();
  const fallback = locale === 'en' ? 'de' : 'en';
  const langs = `${locale},${fallback},mul`;
  return `
SELECT ?item ?itemLabel ?typeLabel ?coord ?image ?inception WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(${west} ${south})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(${east} ${north})"^^geo:wktLiteral .
  }
  ?item wdt:P31/wdt:P279?/wdt:P279?/wdt:P279? wd:Q41176 .
  OPTIONAL { ?item wdt:P31 ?type . }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${langs}" . }
}
LIMIT 200`;
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
    seen.add(id);

    const coords = parseCoord(row.coord.value);
    if (!coords) continue;

    buildings.push({
      id,
      label: row.itemLabel?.value ?? id,
      type: row.typeLabel?.value,
      lat: coords.lat,
      lng: coords.lng,
      image: row.image?.value,
      inception: row.inception?.value,
    });
  }

  return buildings;
}

function buildDetailQuery(id: string, langs: string): string {
  return `
SELECT ?demolished ?heritage ?heritageLabel
  ?occupant ?occupantLabel ?occupStart ?occupEnd
  ?owner ?ownerLabel ?ownerStart ?ownerEnd
  ?address ?addrStart ?addrEnd
  ?architect ?architectLabel
  ?commissioned ?commissionedLabel
WHERE {
  BIND(wd:${id} AS ?item)
  OPTIONAL { ?item wdt:P576 ?demolished . }
  OPTIONAL {
    ?item p:P1435 ?hStmt .
    ?hStmt ps:P1435 ?heritage .
  }
  OPTIONAL {
    ?item p:P466 ?occStmt .
    ?occStmt ps:P466 ?occupant .
    OPTIONAL { ?occStmt pq:P580 ?occupStart . }
    OPTIONAL { ?occStmt pq:P582 ?occupEnd . }
  }
  OPTIONAL {
    ?item p:P127 ?ownStmt .
    ?ownStmt ps:P127 ?owner .
    OPTIONAL { ?ownStmt pq:P580 ?ownerStart . }
    OPTIONAL { ?ownStmt pq:P582 ?ownerEnd . }
  }
  OPTIONAL {
    ?item p:P6375 ?addrStmt .
    ?addrStmt ps:P6375 ?address .
    OPTIONAL { ?addrStmt pq:P580 ?addrStart . }
    OPTIONAL { ?addrStmt pq:P582 ?addrEnd . }
  }
  OPTIONAL {
    ?item p:P84 ?archStmt .
    ?archStmt ps:P84 ?architect .
  }
  OPTIONAL {
    ?item p:P88 ?commStmt .
    ?commStmt ps:P88 ?commissioned .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${langs}" . }
}`;
}

interface DetailBinding {
  demolished?: SparqlBinding;
  heritage?: SparqlBinding;
  heritageLabel?: SparqlBinding;
  occupant?: SparqlBinding;
  occupantLabel?: SparqlBinding;
  occupStart?: SparqlBinding;
  occupEnd?: SparqlBinding;
  owner?: SparqlBinding;
  ownerLabel?: SparqlBinding;
  ownerStart?: SparqlBinding;
  ownerEnd?: SparqlBinding;
  address?: SparqlBinding;
  addrStart?: SparqlBinding;
  addrEnd?: SparqlBinding;
  architect?: SparqlBinding;
  architectLabel?: SparqlBinding;
  commissioned?: SparqlBinding;
  commissionedLabel?: SparqlBinding;
}

export async function fetchBuildingById(
  id: string,
  signal?: AbortSignal,
): Promise<WikidataBuilding | null> {
  const locale = getLocale();
  const fallback = locale === 'en' ? 'de' : 'en';
  const langs = `${locale},${fallback},mul`;

  const query = `
SELECT ?itemLabel ?typeLabel ?coord ?image ?inception WHERE {
  BIND(wd:${id} AS ?item)
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P31 ?type . }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${langs}" . }
}
LIMIT 1`;

  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
  const response = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json' },
    signal,
  });
  if (!response.ok) throw new Error(`SPARQL error: ${response.status}`);

  const data: SparqlResult = await response.json();
  const row = data.results.bindings[0];
  if (!row) return null;

  const coords = row.coord ? parseCoord(row.coord.value) : null;
  return {
    id,
    label: row.itemLabel?.value ?? id,
    type: row.typeLabel?.value,
    lat: coords?.lat ?? 0,
    lng: coords?.lng ?? 0,
    image: row.image?.value,
    inception: row.inception?.value,
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

  let demolished: string | undefined;
  const heritageSet = new Set<string>();
  const occupants = new Map<string, PersonRef>();
  const owners = new Map<string, PersonRef>();
  const addresses = new Map<string, AddressEntry>();
  const architects = new Map<string, PersonRef>();
  const commissionedBy = new Map<string, PersonRef>();

  for (const row of rows) {
    if (row.demolished && !demolished) demolished = row.demolished.value;
    if (row.heritage && row.heritageLabel) heritageSet.add(row.heritageLabel.value);

    if (row.occupant) {
      const key = `${row.occupant.value}|${row.occupStart?.value ?? ''}|${row.occupEnd?.value ?? ''}`;
      if (!occupants.has(key)) {
        occupants.set(key, {
          id: extractQid(row.occupant.value),
          label: row.occupantLabel?.value ?? extractQid(row.occupant.value),
          start: row.occupStart?.value,
          end: row.occupEnd?.value,
        });
      }
    }

    if (row.owner) {
      const key = `${row.owner.value}|${row.ownerStart?.value ?? ''}|${row.ownerEnd?.value ?? ''}`;
      if (!owners.has(key)) {
        owners.set(key, {
          id: extractQid(row.owner.value),
          label: row.ownerLabel?.value ?? extractQid(row.owner.value),
          start: row.ownerStart?.value,
          end: row.ownerEnd?.value,
        });
      }
    }

    if (row.address) {
      const key = `${row.address.value}|${row.addrStart?.value ?? ''}|${row.addrEnd?.value ?? ''}`;
      if (!addresses.has(key)) {
        addresses.set(key, {
          text: row.address.value,
          start: row.addrStart?.value,
          end: row.addrEnd?.value,
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
  }

  const byStart = (a: { start?: string }, b: { start?: string }) => {
    if (!a.start && !b.start) return 0;
    if (!a.start) return 1;
    if (!b.start) return -1;
    return a.start < b.start ? -1 : 1;
  };

  return {
    demolished,
    heritages: [...heritageSet],
    architects: [...architects.values()],
    commissionedBy: [...commissionedBy.values()],
    occupants: [...occupants.values()].sort(byStart),
    owners: [...owners.values()].sort(byStart),
    addresses: [...addresses.values()].sort(byStart),
  };
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
        type: b.type ?? null,
        image: b.image ?? null,
        inception: b.inception ?? null,
      },
    })),
  };
}
