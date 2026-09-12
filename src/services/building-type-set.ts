import { BUILDING_TYPES } from './building-types';
import { EXTRA_BUILDING_TYPES } from './extra-building-types';

/**
 * Every type Domus shows as a building: the crawled Wikidata hierarchy plus the
 * hand-listed types it cannot reach. Import the set from here rather than from
 * building-types.ts, which is generated and knows nothing about the extras.
 */
export const BUILDING_TYPE_SET = new Set<string>([...BUILDING_TYPES, ...EXTRA_BUILDING_TYPES]);
