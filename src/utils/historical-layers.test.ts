import { describe, it, expect } from 'vitest';
import { boundsIntersect, isLayerRelevant, splitAttribution } from './historical-layers';
import type { HistoricalLayerSource } from '../config/historical-layers';

function makeLayer(overrides: Partial<HistoricalLayerSource> = {}): HistoricalLayerSource {
  return {
    id: 'test-layer',
    title: 'Test Layer',
    region: 'Test Region',
    yearRange: [1900, 1950],
    tiles: ['https://example.com/{z}/{x}/{y}.png'],
    attribution: '© Test Provider, some license',
    ...overrides,
  };
}

describe('boundsIntersect', () => {
  it('detects overlapping boxes', () => {
    expect(boundsIntersect([0, 0, 10, 10], [5, 5, 15, 15])).toBe(true);
  });

  it('detects disjoint boxes', () => {
    expect(boundsIntersect([0, 0, 10, 10], [20, 20, 30, 30])).toBe(false);
  });

  it('detects touching-edge boxes as intersecting', () => {
    expect(boundsIntersect([0, 0, 10, 10], [10, 10, 20, 20])).toBe(true);
  });

  it('detects one box fully containing another', () => {
    expect(boundsIntersect([0, 0, 100, 100], [10, 10, 20, 20])).toBe(true);
  });

  it('detects boxes aligned on one axis but disjoint on the other', () => {
    // Same longitude range, but latitude ranges don't overlap (the Stuttgart/
    // Baden case: same east-west band, different north-south coverage).
    expect(boundsIntersect([7, 47, 9, 48], [7, 49, 9, 50])).toBe(false);
  });
});

describe('isLayerRelevant', () => {
  const bwBounds: [number, number, number, number] = [7.2, 47.4, 10.7, 50.0];

  it('is relevant when no bounds are configured (global/demo layer)', () => {
    const layer = makeLayer({ bounds: undefined });
    expect(isLayerRelevant(layer, [0, 0, 1, 1], null)).toBe(true);
  });

  it('is relevant when no viewport bounds are known yet', () => {
    const layer = makeLayer({ bounds: bwBounds });
    expect(isLayerRelevant(layer, null, null)).toBe(true);
  });

  it('is relevant when viewport intersects the layer bounds', () => {
    const layer = makeLayer({ bounds: bwBounds });
    expect(isLayerRelevant(layer, [8, 48, 9, 49], null)).toBe(true);
  });

  it('is not relevant when viewport is outside the layer bounds', () => {
    const layer = makeLayer({ bounds: bwBounds });
    expect(isLayerRelevant(layer, [20, 20, 21, 21], null)).toBe(false);
  });

  it('stays relevant when active, even outside its bounds', () => {
    const layer = makeLayer({ id: 'active-layer', bounds: bwBounds });
    expect(isLayerRelevant(layer, [20, 20, 21, 21], 'active-layer')).toBe(true);
  });
});

describe('splitAttribution', () => {
  it('returns null when no attributionUrl is configured', () => {
    const layer = makeLayer({ attributionLinkText: 'Test Provider' });
    expect(splitAttribution(layer)).toBeNull();
  });

  it('returns null when no attributionLinkText is configured', () => {
    const layer = makeLayer({ attributionUrl: 'https://example.com' });
    expect(splitAttribution(layer)).toBeNull();
  });

  it('returns null when linkText is not found in attribution', () => {
    const layer = makeLayer({
      attributionUrl: 'https://example.com',
      attributionLinkText: 'Nonexistent',
    });
    expect(splitAttribution(layer)).toBeNull();
  });

  it('splits attribution around the link text', () => {
    const layer = makeLayer({
      attribution: '© LGL-BW, Datenlizenz Deutschland – Namensnennung – Version 2.0',
      attributionUrl: 'https://www.lgl-bw.de',
      attributionLinkText: 'LGL-BW',
    });
    expect(splitAttribution(layer)).toEqual({
      before: '© ',
      linked: 'LGL-BW',
      after: ', Datenlizenz Deutschland – Namensnennung – Version 2.0',
    });
  });

  it('handles link text at the very start of the attribution', () => {
    const layer = makeLayer({
      attribution: 'swisstopo and contributors',
      attributionUrl: 'https://swisstopo.admin.ch',
      attributionLinkText: 'swisstopo',
    });
    expect(splitAttribution(layer)).toEqual({
      before: '',
      linked: 'swisstopo',
      after: ' and contributors',
    });
  });
});
