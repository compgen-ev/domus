const OHM_OVERPASS = 'https://overpass-api.openhistoricalmap.org/api/interpreter';

export interface OhmBuildingPrefill {
  lat: number;
  lng: number;
  ohmId?: string;
  name?: string;
  buildingTag?: string;
  startDate?: string;
  endDate?: string;
}

const BUILDING_TAG_TO_WIKIDATA: Record<string, { id: string; label: string }> = {
  house:            { id: 'Q20034440', label: 'Einfamilienhaus' },
  detached:         { id: 'Q20034440', label: 'Einfamilienhaus' },
  semidetached_house: { id: 'Q20034440', label: 'Einfamilienhaus' },
  terrace:          { id: 'Q20034440', label: 'Einfamilienhaus' },
  residential:      { id: 'Q3947',     label: 'Wohnhaus' },
  apartments:       { id: 'Q1021106',  label: 'Mehrfamilienhaus' },
  flat:             { id: 'Q1021106',  label: 'Mehrfamilienhaus' },
  farm:             { id: 'Q188869',   label: 'Bauernhaus' },
  farm_auxiliary:   { id: 'Q188869',   label: 'Bauernhaus' },
  barn:             { id: 'Q162113',   label: 'Scheune' },
  stable:           { id: 'Q1662011',  label: 'Stall' },
  warehouse:        { id: 'Q1662536',  label: 'Speicher' },
  storage:          { id: 'Q1662536',  label: 'Speicher' },
  church:           { id: 'Q16970',    label: 'Kirchengebäude' },
  chapel:           { id: 'Q108325',   label: 'Kapelle' },
  school:           { id: 'Q149566',   label: 'Schulgebäude' },
  civic:            { id: 'Q25550691', label: 'Rathaus' },
  public:           { id: 'Q25550691', label: 'Rathaus' },
  mill:             { id: 'Q44494',    label: 'Mühle' },
  manor:            { id: 'Q879050',   label: 'Herrenhaus' },
  palace:           { id: 'Q23413',    label: 'Schloss' },
  castle:           { id: 'Q23691',    label: 'Burg' },
  fort:             { id: 'Q23691',    label: 'Burg' },
  industrial:       { id: 'Q1542143',  label: 'Fabrikgebäude' },
  factory:          { id: 'Q1542143',  label: 'Fabrikgebäude' },
  workshop:         { id: 'Q656720',   label: 'Werkstatt' },
  hotel:            { id: 'Q27686',    label: 'Gasthaus' },
  inn:              { id: 'Q27686',    label: 'Gasthaus' },
  train_station:    { id: 'Q18543139', label: 'Bahnhofsgebäude' },
};

export function buildingTagToWikidataType(tag: string | undefined): { id: string; label: string } | undefined {
  if (!tag) return undefined;
  return BUILDING_TAG_TO_WIKIDATA[tag.toLowerCase()];
}

export interface OhmFetchResult {
  geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  elementId?: string;
  elementType?: 'way' | 'relation';
}

// Cache to prevent duplicate queries
const queryCache = new Map<string, { result: OhmFetchResult; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes (longer to reduce API calls)

// Track in-flight requests to prevent duplicates
const inflightRequests = new Map<string, Promise<OhmFetchResult>>();

// Track last request time to avoid rate limits
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

async function _fetchOhmWays(
  query: string,
  signal?: AbortSignal,
  retryCount = 0,
): Promise<OhmFetchResult> {
  // Check cache first
  const cached = queryCache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  // Check if request is already in-flight
  const inflight = inflightRequests.get(query);
  if (inflight) {
    return inflight;
  }

  // Make new request
  const requestPromise = (async () => {
    try {
      // Rate limiting: ensure minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
      }
      lastRequestTime = Date.now();

      const response = await fetch(OHM_OVERPASS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal,
      });

      if (!response.ok) {
        const text = await response.text();
        if (text.includes('duplicate_query') && retryCount < 2) {
          // Retry after 2 seconds if duplicate query (max 2 retries)
          await new Promise(resolve => setTimeout(resolve, 2000));
          return _fetchOhmWays(query, signal, retryCount + 1);
        }
        // Return empty result instead of throwing
        console.warn('OHM Overpass error:', response.status);
        return { geojson: { type: 'FeatureCollection' as const, features: [] } };
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        const text = await response.text();
        if (text.includes('duplicate_query') && retryCount < 2) {
          // Retry after 2 seconds if duplicate query (max 2 retries)
          await new Promise(resolve => setTimeout(resolve, 2000));
          return _fetchOhmWays(query, signal, retryCount + 1);
        }
        // Return empty result instead of throwing
        console.warn('OHM returned non-JSON response');
        return { geojson: { type: 'FeatureCollection' as const, features: [] } };
      }

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

      const result: OhmFetchResult = {
        geojson: { type: 'FeatureCollection', features },
        elementId: firstElementId,
        elementType: firstElementType,
      };

      // Cache the result
      queryCache.set(query, { result, timestamp: Date.now() });

      return result;
    } finally {
      // Clean up in-flight tracking
      inflightRequests.delete(query);
    }
  })();

  // Track in-flight request
  inflightRequests.set(query, requestPromise);

  return requestPromise;
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

export async function fetchOhmWayTags(
  osmId: number,
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const query = `[out:json];way(${osmId});out tags;`;
  try {
    const response = await fetch(OHM_OVERPASS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }),
      signal,
    });
    if (!response.ok) return {};
    const data = await response.json();
    return (data.elements?.[0]?.tags as Record<string, string>) ?? {};
  } catch {
    return {};
  }
}
