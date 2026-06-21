import { describe, it, expect } from 'vitest';
import { parseDate, formatDate, isValidDateInput, getDateValidationError } from './dates';

describe('parseDate', () => {
  describe('year-only format (precision 9)', () => {
    it('parses positive year', () => {
      const result = parseDate('1950');
      expect(result).toEqual({
        time: '+1950-00-00T00:00:00Z',
        precision: 9,
        calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
      });
    });

    it('parses year with explicit + prefix', () => {
      const result = parseDate('+1950');
      expect(result).toEqual({
        time: '+1950-00-00T00:00:00Z',
        precision: 9,
        calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
      });
    });

    it('parses BCE year with - prefix', () => {
      const result = parseDate('-500');
      expect(result).toEqual({
        time: '-0500-00-00T00:00:00Z',
        precision: 9,
        calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
      });
    });

    it('pads short years to 4 digits', () => {
      const result = parseDate('50');
      expect(result?.time).toBe('+0050-00-00T00:00:00Z');
    });

    it('handles 1-digit year', () => {
      const result = parseDate('5');
      expect(result?.time).toBe('+0005-00-00T00:00:00Z');
    });
  });

  describe('year-month format (precision 10)', () => {
    it('parses year-month', () => {
      const result = parseDate('1950-06');
      expect(result).toEqual({
        time: '+1950-06-00T00:00:00Z',
        precision: 10,
        calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
      });
    });

    it('parses BCE year-month', () => {
      const result = parseDate('-500-03');
      expect(result?.time).toBe('-0500-03-00T00:00:00Z');
      expect(result?.precision).toBe(10);
    });

    it('rejects invalid month (00)', () => {
      expect(parseDate('1950-00')).toBeNull();
    });

    it('rejects invalid month (13)', () => {
      expect(parseDate('1950-13')).toBeNull();
    });

    it('accepts month 01', () => {
      expect(parseDate('1950-01')?.precision).toBe(10);
    });

    it('accepts month 12', () => {
      expect(parseDate('1950-12')?.precision).toBe(10);
    });
  });

  describe('full date format (precision 11)', () => {
    it('parses full date', () => {
      const result = parseDate('1950-06-15');
      expect(result).toEqual({
        time: '+1950-06-15T00:00:00Z',
        precision: 11,
        calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
      });
    });

    it('parses BCE full date', () => {
      const result = parseDate('-500-03-21');
      expect(result?.time).toBe('-0500-03-21T00:00:00Z');
      expect(result?.precision).toBe(11);
    });

    it('rejects invalid month in full date', () => {
      expect(parseDate('1950-13-15')).toBeNull();
    });

    it('rejects invalid day (00)', () => {
      expect(parseDate('1950-06-00')).toBeNull();
    });

    it('rejects invalid day (32)', () => {
      expect(parseDate('1950-06-32')).toBeNull();
    });

    it('accepts day 01', () => {
      expect(parseDate('1950-06-01')?.precision).toBe(11);
    });

    it('accepts day 31', () => {
      expect(parseDate('1950-06-31')?.precision).toBe(11);
    });
  });

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseDate('')).toBeNull();
    });

    it('returns null for whitespace', () => {
      expect(parseDate('   ')).toBeNull();
    });

    it('trims whitespace', () => {
      const result = parseDate('  1950  ');
      expect(result?.time).toBe('+1950-00-00T00:00:00Z');
    });

    it('returns null for invalid format', () => {
      expect(parseDate('not a date')).toBeNull();
    });

    it('returns null for partial date', () => {
      expect(parseDate('1950-')).toBeNull();
    });

    it('returns null for slash format', () => {
      expect(parseDate('06/15/1950')).toBeNull();
    });
  });
});

describe('formatDate', () => {
  describe('year precision', () => {
    it('formats year-only date', () => {
      expect(formatDate('+1950-00-00T00:00:00Z')).toBe('1950');
    });

    it('formats BCE year', () => {
      expect(formatDate('-0500-00-00T00:00:00Z')).toBe('-500');
    });

    it('removes leading zeros from year', () => {
      expect(formatDate('+0050-00-00T00:00:00Z')).toBe('50');
    });

    it('detects fake precision (01-01)', () => {
      expect(formatDate('+1950-01-01T00:00:00Z')).toBe('1950');
    });
  });

  describe('month precision', () => {
    it('formats year-month date', () => {
      expect(formatDate('+1950-06-00T00:00:00Z')).toBe('1950-06');
    });

    it('formats BCE year-month', () => {
      expect(formatDate('-0500-03-00T00:00:00Z')).toBe('-500-03');
    });
  });

  describe('day precision', () => {
    it('formats full date', () => {
      expect(formatDate('+1950-06-15T00:00:00Z')).toBe('1950-06-15');
    });

    it('formats BCE full date', () => {
      expect(formatDate('-0500-03-21T00:00:00Z')).toBe('-500-03-21');
    });

    it('does not show day 01 as year-only', () => {
      expect(formatDate('+1950-06-01T00:00:00Z')).toBe('1950-06-01');
    });
  });

  describe('edge cases', () => {
    it('returns input unchanged for invalid format', () => {
      expect(formatDate('invalid')).toBe('invalid');
    });

    it('handles dates without time component', () => {
      expect(formatDate('+1950-06-15')).toBe('1950-06-15');
    });
  });
});

describe('isValidDateInput', () => {
  it('accepts year-only', () => {
    expect(isValidDateInput('1950')).toBe(true);
  });

  it('accepts year-month', () => {
    expect(isValidDateInput('1950-06')).toBe(true);
  });

  it('accepts full date', () => {
    expect(isValidDateInput('1950-06-15')).toBe(true);
  });

  it('accepts BCE dates', () => {
    expect(isValidDateInput('-500')).toBe(true);
  });

  it('rejects invalid format', () => {
    expect(isValidDateInput('06/15/1950')).toBe(false);
  });

  it('rejects invalid month', () => {
    expect(isValidDateInput('1950-13')).toBe(false);
  });

  it('rejects invalid day', () => {
    expect(isValidDateInput('1950-06-32')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidDateInput('')).toBe(false);
  });
});

describe('getDateValidationError', () => {
  it('returns null for valid year', () => {
    expect(getDateValidationError('1950')).toBeNull();
  });

  it('returns null for valid month', () => {
    expect(getDateValidationError('1950-06')).toBeNull();
  });

  it('returns null for valid day', () => {
    expect(getDateValidationError('1950-06-15')).toBeNull();
  });

  it('returns error for invalid format', () => {
    const error = getDateValidationError('not-a-date');
    expect(error).toContain('Format');
  });

  it('returns error for invalid month', () => {
    const error = getDateValidationError('1950-13');
    expect(error).toContain('Monat');
  });

  it('returns error for month 00', () => {
    const error = getDateValidationError('1950-00');
    expect(error).toContain('Monat');
  });

  it('returns error for invalid day', () => {
    const error = getDateValidationError('1950-06-32');
    expect(error).toContain('Tag');
  });

  it('returns error for day 00', () => {
    const error = getDateValidationError('1950-06-00');
    expect(error).toContain('Tag');
  });

  it('returns null for empty string', () => {
    expect(getDateValidationError('')).toBeNull();
  });
});

describe('round-trip (parse → format)', () => {
  it('preserves year-only', () => {
    const parsed = parseDate('1950');
    expect(parsed).not.toBeNull();
    const formatted = formatDate(parsed!.time);
    expect(formatted).toBe('1950');
  });

  it('preserves year-month', () => {
    const parsed = parseDate('1950-06');
    expect(parsed).not.toBeNull();
    const formatted = formatDate(parsed!.time);
    expect(formatted).toBe('1950-06');
  });

  it('preserves full date', () => {
    const parsed = parseDate('1950-06-15');
    expect(parsed).not.toBeNull();
    const formatted = formatDate(parsed!.time);
    expect(formatted).toBe('1950-06-15');
  });

  it('preserves BCE dates', () => {
    const parsed = parseDate('-500');
    expect(parsed).not.toBeNull();
    const formatted = formatDate(parsed!.time);
    expect(formatted).toBe('-500');
  });
});
