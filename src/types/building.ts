export interface WikidataBuilding {
  id: string;
  label: string;
  type?: string;
  lat: number;
  lng: number;
  image?: string;
  inception?: string;
}

export type BuildingFeatureProperties = Omit<WikidataBuilding, 'lat' | 'lng'>;

export interface PersonRef {
  id: string;
  label: string;
  start?: string;
  end?: string;
}

export interface AddressEntry {
  text: string;
  start?: string;
  end?: string;
}

export interface BuildingDetail {
  demolished?: string;
  heritages: string[];
  architects: PersonRef[];
  commissionedBy: PersonRef[];
  occupants: PersonRef[];
  owners: PersonRef[];
  addresses: AddressEntry[];
}
