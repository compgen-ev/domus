import { OHM_TAG_TO_BUILDING_TYPE_ID, getBuildingTypeLabel } from './building-type-options';

const OHM_OVERPASS = 'https://overpass-api.openhistoricalmap.org/api/interpreter';
const OHM_API = 'https://api.openhistoricalmap.org/api/0.6';

export interface OhmBuildingPrefill {
  lat: number;
  lng: number;
  ohmId?: string;
  elementType?: 'way' | 'relation';
  name?: string;
  buildingTag?: string;
  startDate?: string;
  endDate?: string;
}

export function buildingTagToWikidataType(tag: string | undefined): { id: string; label: string } | undefined {
  if (!tag) return undefined;
  const id = OHM_TAG_TO_BUILDING_TYPE_ID[tag.toLowerCase()];
  if (!id) return undefined;
  return { id, label: getBuildingTypeLabel(id) };
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

export function fetchOhmWayGeometry(
  wayId: string,
  signal?: AbortSignal,
): Promise<OhmFetchResult> {
  const query = `[out:json];way(${wayId});out geom;`;
  return _fetchOhmWays(query, signal);
}

export function fetchOhmByWikidataId(
  qid: string,
  signal?: AbortSignal,
): Promise<OhmFetchResult> {
  const query = `[out:json];(relation[wikidata=${qid}];way[wikidata=${qid}];);out geom;`;
  return _fetchOhmWays(query, signal);
}

export async function addWikidataTag(
  elementType: 'way' | 'relation',
  elementId: string,
  qid: string,
  token: string,
): Promise<void> {
  // Fetch current element to get its version, nodes, and existing tags
  const fetchRes = await fetch(`${OHM_API}/${elementType}/${elementId}`);
  if (!fetchRes.ok) throw new Error(`OHM fetch failed: HTTP ${fetchRes.status}`);
  const xmlText = await fetchRes.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const el = doc.querySelector(elementType);
  if (!el) throw new Error(`${elementType} not found in OHM response`);

  const existing = [...el.querySelectorAll('tag')].find(t => t.getAttribute('k') === 'wikidata');
  if (existing) {
    if (existing.getAttribute('v') === qid) return; // already correct, nothing to do
    throw new Error(`OHM element already has wikidata=${existing.getAttribute('v')}`);
  }

  const tag = doc.createElement('tag');
  tag.setAttribute('k', 'wikidata');
  tag.setAttribute('v', qid);
  el.appendChild(tag);

  const changesetRes = await fetch(`${OHM_API}/changeset/create`, {
    method:  'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/xml' },
    body:    `<osm><changeset><tag k="comment" v="Add Wikidata tag ${qid}"/><tag k="created_by" v="domus"/></changeset></osm>`,
  });
  if (!changesetRes.ok) throw new Error(`OHM changeset create failed: HTTP ${changesetRes.status}`);
  const changesetId = (await changesetRes.text()).trim();

  el.setAttribute('changeset', changesetId);
  const updatedXml = new XMLSerializer().serializeToString(doc);

  let uploadOk = false;
  try {
    const uploadRes = await fetch(`${OHM_API}/${elementType}/${elementId}`, {
      method:  'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/xml' },
      body:    updatedXml,
    });
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`OHM upload failed: HTTP ${uploadRes.status} — ${text}`);
    }
    uploadOk = true;
  } finally {
    await fetch(`${OHM_API}/changeset/${changesetId}/close`, {
      method:  'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!uploadOk) throw new Error('OHM upload failed');
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
