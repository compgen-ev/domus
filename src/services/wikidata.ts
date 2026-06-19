import type { WikidataBuilding } from '../types/building';
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
