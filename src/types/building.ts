import type { WikidataTime, StatementDate } from '../utils/dates';
export type { WikidataTime, StatementDate };

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
  /** Structured date with authoritative precision and calendar model. */
  inception?: StatementDate;
  modified?: string;
}

export type BuildingFeatureProperties = Omit<WikidataBuilding, 'lat' | 'lng'>;

export interface PersonRef {
  id: string;
  label: string;
  /** P580 "start time" qualifier. */
  start?: WikidataTime;
  /** P582 "end time" qualifier. */
  end?: WikidataTime;
}

export interface AddressEntry {
  text: string;
  /** P580 "start time" qualifier. */
  start?: WikidataTime;
  /** P582 "end time" qualifier. */
  end?: WikidataTime;
}

export interface BuildingDetail {
  /** Structured date with authoritative precision and calendar model. */
  demolished?: StatementDate;
  heritages: string[];
  images: string[];
  architects: PersonRef[];
  commissionedBy: PersonRef[];
  occupants: PersonRef[];
  owners: PersonRef[];
  addresses: AddressEntry[];
  replacedBy: WikidataItem[];
  replaces: WikidataItem[];
  ohmId?: string;
  govId?: string;
  modified?: string;
}
