export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<NominatimResult[]> {
  const params = new URLSearchParams({ q: query, format: 'json', limit: '5' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'house-history/1.0' },
    signal,
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}
