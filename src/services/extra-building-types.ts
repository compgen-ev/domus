/**
 * Types Domus treats as buildings that Wikidata's building hierarchy does not
 * currently reach.
 *
 * Wikidata files these under the agricultural holding or the building-complex
 * branch, neither of which is a subclass of Q41176 (building), so the generated
 * list in building-types.ts cannot contain them.
 *
 * These are listed flat, never as crawl roots. Their subtrees mix in settlement
 * types (Einzelsiedlung, Chutor), land parcels (Plantage, Weinberg) and
 * organisations (military units, schools), none of which belong on a map of
 * house histories. The trade-off is that a new subclass added upstream — say a
 * Dreiseithof under Bauernhof — has to be added here by hand.
 */
export const EXTRA_BUILDING_TYPES = [
  'Q131596', // Bauernhof — reclassified upstream as an agricultural holding, not a building
  'Q1497364', // Gebäudekomplex — a group of buildings is not itself a building
  'Q72030539', // farmstead / Gehöft — the built ensemble of a farm
  'Q2116450', // Rittergut
  'Q2066754', // Baltisches Gut
  'Q477195', // Meierhof
  'Q2523674', // Vierseithof
] as const;
