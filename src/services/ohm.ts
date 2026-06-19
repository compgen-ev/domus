const OHM_OVERPASS = 'https://overpass-api.openhistoricalmap.org/api/interpreter';

export interface OhmFetchResult {
  geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  elementId?: string;
  elementType?: 'way' | 'relation';
}

async function _fetchOhmWays(
  query: string,
  signal?: AbortSignal,
): Promise<OhmFetchResult> {
  const response = await fetch(OHM_OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
    signal,
  });

  if (!response.ok) throw new Error(`OHM Overpass error: ${response.status}`);

  const data = await response.json();
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  let firstElementId: string | undefined;
  let firstElementType: 'way' | 'relation' | undefined;

  for (const el of data.elements ?? []) {
    if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 3) continue;

    if (!firstElementId && el.id) {
      firstElementId = String(el.id);
      firstElementType = el.type;
    }

    const coords: [number, number][] = el.geometry.map(
      ({ lon, lat }: { lon: number; lat: number }) => [lon, lat],
    );

    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: el.tags ?? {},
    });
  }

  return {
    geojson: { type: 'FeatureCollection', features },
    elementId: firstElementId,
    elementType: firstElementType,
  };
}

export function fetchOhmRelationGeometry(
  relationId: string,
  signal?: AbortSignal,
): Promise<OhmFetchResult> {
  const query = `[out:json];relation(${relationId});way(r);out geom;`;
  return _fetchOhmWays(query, signal);
}

export function fetchOhmByWikidataId(
  qid: string,
  signal?: AbortSignal,
): Promise<OhmFetchResult> {
  const query = `[out:json];(relation[wikidata=${qid}];way[wikidata=${qid}];);out geom;`;
  return _fetchOhmWays(query, signal);
}
