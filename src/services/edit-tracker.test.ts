import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isStale, cleanupExpired, recordEdit, getLastEdit } from './edit-tracker';

describe('edit-tracker', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isStale', () => {
    it('returns false when no edit recorded', () => {
      expect(isStale('Q123', '2026-06-22T12:00:00Z')).toBe(false);
    });

    it('returns false when no SPARQL timestamp provided', () => {
      recordEdit('Q123');
      expect(isStale('Q123', undefined)).toBe(false);
    });

    it('returns true when SPARQL modified before our edit', () => {
      // Record edit at current time
      recordEdit('Q123');
      // SPARQL says modified 1 hour ago
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      expect(isStale('Q123', oneHourAgo)).toBe(true);
    });

    it('returns false when SPARQL modified after our edit', () => {
      // Record edit at current time
      recordEdit('Q123');
      // SPARQL says modified in the future (impossible but tests the logic)
      const future = new Date(Date.now() + 60 * 1000).toISOString();
      expect(isStale('Q123', future)).toBe(false);
    });

    it('returns false when timestamps are equal', () => {
      const timestamp = '2026-06-22T12:00:00.000Z';
      // Manually set edit timestamp to exact value
      localStorage.setItem('wikidata-edits', JSON.stringify({ Q123: timestamp }));
      expect(isStale('Q123', timestamp)).toBe(false);
    });

    it('handles invalid timestamp gracefully', () => {
      recordEdit('Q123');
      expect(isStale('Q123', 'not-a-date')).toBe(false);
    });

    it('handles malformed stored timestamp gracefully', () => {
      localStorage.setItem('wikidata-edits', JSON.stringify({ Q123: 'invalid' }));
      expect(isStale('Q123', '2026-06-22T12:00:00Z')).toBe(false);
    });

    it('differentiates between entities', () => {
      recordEdit('Q123');
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      expect(isStale('Q123', oneHourAgo)).toBe(true);
      expect(isStale('Q456', oneHourAgo)).toBe(false); // different entity
    });
  });

  describe('cleanupExpired', () => {
    it('removes timestamps older than 1 hour', () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000).toISOString();

      localStorage.setItem('wikidata-edits', JSON.stringify({
        Q123: twoHoursAgo,    // should be removed
        Q456: thirtyMinutesAgo, // should remain
      }));

      cleanupExpired();

      expect(getLastEdit('Q123')).toBeNull();
      expect(getLastEdit('Q456')).toBe(thirtyMinutesAgo);
    });

    it('removes timestamps older than 1 hour, keeps those at boundary', () => {
      const frozenNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(frozenNow);

      const slightlyOver = new Date(frozenNow - 60 * 60 * 1000 - 1000).toISOString(); // 1h 1s ago
      const exactlyOneHour = new Date(frozenNow - 60 * 60 * 1000).toISOString();
      const justUnder = new Date(frozenNow - 60 * 60 * 1000 + 1000).toISOString(); // 59 min 59s

      localStorage.setItem('wikidata-edits', JSON.stringify({
        Q123: slightlyOver,
        Q456: exactlyOneHour,
        Q789: justUnder,
      }));

      cleanupExpired();

      expect(getLastEdit('Q123')).toBeNull(); // removed (> 1 hour)
      expect(getLastEdit('Q456')).toBe(exactlyOneHour); // kept (= 1 hour)
      expect(getLastEdit('Q789')).toBe(justUnder); // kept (< 1 hour)

      vi.restoreAllMocks();
    });

    it('handles malformed timestamps by removing them', () => {
      localStorage.setItem('wikidata-edits', JSON.stringify({
        Q123: 'not-a-date',
        Q456: new Date().toISOString(),
      }));

      cleanupExpired();

      expect(getLastEdit('Q123')).toBeNull();
      expect(getLastEdit('Q456')).not.toBeNull();
    });

    it('does nothing when all timestamps are fresh', () => {
      const recent = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago

      localStorage.setItem('wikidata-edits', JSON.stringify({
        Q123: recent,
        Q456: recent,
      }));

      cleanupExpired();

      expect(getLastEdit('Q123')).toBe(recent);
      expect(getLastEdit('Q456')).toBe(recent);
    });

    it('handles empty storage gracefully', () => {
      expect(() => cleanupExpired()).not.toThrow();
    });

    it('handles corrupted JSON gracefully', () => {
      localStorage.setItem('wikidata-edits', 'not-valid-json');
      expect(() => cleanupExpired()).not.toThrow();
    });
  });
});
