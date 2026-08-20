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
  wikiTreeId?: string;
  modified?: string;
}

/**
 * Values Wikidata has confirmed writing (the PATCH returned 2xx) but that the
 * SPARQL endpoint has not indexed yet. Used to prefill a second edit so it
 * starts from what the user just saved rather than from stale query results.
 *
 * In-memory only — deliberately never persisted. If it is lost, the UI falls
 * back to SPARQL data, which is the pre-existing behaviour; it can never make
 * an unsaved change look saved.
 */
export interface SavedBuildingValues {
  id: string;
  label: string;
  type?: WikidataItem;
  inception?: StatementDate;
  demolished?: StatementDate;
}
