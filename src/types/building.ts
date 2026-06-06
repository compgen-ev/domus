export interface WikidataBuilding {
  id: string;        // Wikidata QID, e.g. "Q12345"
  label: string;
  type?: string;     // human-readable type label (e.g. "house", "church")
  lat: number;
  lng: number;
  image?: string;    // Wikimedia Commons image URL
  inception?: string; // ISO date string
}

export type BuildingFeatureProperties = Omit<WikidataBuilding, 'lat' | 'lng'>;
