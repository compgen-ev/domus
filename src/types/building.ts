export interface WikidataItem {
  id: string;
  label: string;
}

export interface WikidataBuilding {
  id: string;
  label: string;
  type?: WikidataItem;
  lat: number;
  lng: number;
  image?: string;
  inception?: string;
  modified?: string;
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
  ohmId?: string;
  govId?: string;
  modified?: string;
}
