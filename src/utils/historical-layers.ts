import type { HistoricalLayerSource } from '../config/historical-layers';

export type Bounds = [west: number, south: number, east: number, north: number];

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  const [w1, s1, e1, n1] = a;
  const [w2, s2, e2, n2] = b;
  return w1 <= e2 && e1 >= w2 && s1 <= n2 && n1 >= s2;
}

// Layers without `bounds` are treated as globally relevant (e.g. demo/basemap
// sources). The currently active layer always stays relevant so the user can
// turn it off even after panning away from its coverage.
export function isLayerRelevant(
  layer: HistoricalLayerSource,
  viewportBounds: Bounds | null,
  activeLayerId: string | null,
): boolean {
  if (!layer.bounds || layer.id === activeLayerId) return true;
  if (!viewportBounds) return true;
  return boundsIntersect(layer.bounds, viewportBounds);
}

export interface AttributionParts {
  before: string;
  linked: string;
  after: string;
}

// Splits `attribution` around the substring `linkText` so callers can render
// just that substring as a hyperlink. Returns null if linking isn't possible
// (no URL/linkText configured, or linkText isn't actually found).
export function splitAttribution(layer: HistoricalLayerSource): AttributionParts | null {
  if (!layer.attributionUrl || !layer.attributionLinkText) return null;

  const idx = layer.attribution.indexOf(layer.attributionLinkText);
  if (idx === -1) return null;

  return {
    before: layer.attribution.slice(0, idx),
    linked: layer.attribution.slice(idx, idx + layer.attributionLinkText.length),
    after: layer.attribution.slice(idx + layer.attributionLinkText.length),
  };
}
