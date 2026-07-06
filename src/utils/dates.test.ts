import { describe, it, expect } from 'vitest';
import {
  parseDate,
  formatDate,
  formatDateValue,
  wikidataTimeStringToValue,
  dateValueToInputString,
  formatStatementDate,
  statementDateFromTimeString,
  isValidDateInput,
  getDateValidationError,
  type WikidataTime,
} from './dates';

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
        calendarmodel: 'http://www.wikidata.org/entity/Q1985786', // Julian for BCE
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

    it('does not apply 01-01 heuristic (January 1 returned as-is)', () => {
      // Without authoritative precision, January 1 is shown as day precision.
      // Use formatDateValue with precision=9 to display year-only correctly.
      expect(formatDate('+1950-01-01T00:00:00Z')).toBe('1950-01-01');
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

describe('calendar model selection', () => {
  const JULIAN = 'http://www.wikidata.org/entity/Q1985786';
  const GREGORIAN = 'http://www.wikidata.org/entity/Q1985727';

  it('uses Julian calendar for year 1582 and before', () => {
    expect(parseDate('1582')?.calendarmodel).toBe(JULIAN);
    expect(parseDate('1500')?.calendarmodel).toBe(JULIAN);
    expect(parseDate('1000')?.calendarmodel).toBe(JULIAN);
    expect(parseDate('1')?.calendarmodel).toBe(JULIAN);
  });

  it('uses Gregorian calendar for year 1583 and after', () => {
    expect(parseDate('1583')?.calendarmodel).toBe(GREGORIAN);
    expect(parseDate('1600')?.calendarmodel).toBe(GREGORIAN);
    expect(parseDate('2000')?.calendarmodel).toBe(GREGORIAN);
  });

  it('uses Julian calendar for BCE dates', () => {
    expect(parseDate('-500')?.calendarmodel).toBe(JULIAN);
    expect(parseDate('-100')?.calendarmodel).toBe(JULIAN);
  });

  it('uses correct calendar for year-month format', () => {
    expect(parseDate('1582-12')?.calendarmodel).toBe(JULIAN);
    expect(parseDate('1583-01')?.calendarmodel).toBe(GREGORIAN);
  });

  it('uses correct calendar for full date format', () => {
    expect(parseDate('1582-12-31')?.calendarmodel).toBe(JULIAN);
    expect(parseDate('1583-01-01')?.calendarmodel).toBe(GREGORIAN);
  });
});

// ─── wikidataTimeStringToValue ───────────────────────────────────────────────

describe('wikidataTimeStringToValue', () => {
  const JULIAN = 'http://www.wikidata.org/entity/Q1985786';
  const GREGORIAN = 'http://www.wikidata.org/entity/Q1985727';

  it('infers year precision from month=00 and day=00', () => {
    const v = wikidataTimeStringToValue('+1950-00-00T00:00:00Z');
    expect(v?.precision).toBe(9);
    expect(v?.time).toBe('+1950-00-00T00:00:00Z');
    expect(v?.calendarmodel).toBe(GREGORIAN);
  });

  it('infers month precision from day=00', () => {
    const v = wikidataTimeStringToValue('+1950-06-00T00:00:00Z');
    expect(v?.precision).toBe(10);
  });

  it('infers day precision otherwise', () => {
    const v = wikidataTimeStringToValue('+1950-06-15T00:00:00Z');
    expect(v?.precision).toBe(11);
  });

  it('infers day precision for January 1 (limitation: cannot distinguish year-precision SPARQL-normalised values)', () => {
    const v = wikidataTimeStringToValue('+1950-01-01T00:00:00Z');
    // Precision 11 — known limitation when SPARQL normalises year-precision to 01-01
    expect(v?.precision).toBe(11);
  });

  it('handles BCE year — Julian calendar, precision 9', () => {
    const v = wikidataTimeStringToValue('-0500-00-00T00:00:00Z');
    expect(v?.precision).toBe(9);
    expect(v?.calendarmodel).toBe(JULIAN);
  });

  it('handles Gregorian boundary (1583)', () => {
    expect(wikidataTimeStringToValue('+1583-00-00T00:00:00Z')?.calendarmodel).toBe(GREGORIAN);
    expect(wikidataTimeStringToValue('+1582-00-00T00:00:00Z')?.calendarmodel).toBe(JULIAN);
  });

  it('returns null for non-time strings', () => {
    expect(wikidataTimeStringToValue('not-a-date')).toBeNull();
    expect(wikidataTimeStringToValue('')).toBeNull();
    expect(wikidataTimeStringToValue('1950')).toBeNull();
  });

  it('handles long year (5+ digits)', () => {
    const v = wikidataTimeStringToValue('-13798000000-01-01T00:00:00Z');
    expect(v?.precision).toBe(11);
  });
});

// ─── formatDateValue ─────────────────────────────────────────────────────────

describe('formatDateValue', () => {
  function wdt(time: string, precision: number): WikidataTime {
    return { time, precision, calendarmodel: 'http://www.wikidata.org/entity/Q1985727' };
  }

  describe('day precision (11)', () => {
    it('formats YYYY-MM-DD', () => {
      expect(formatDateValue(wdt('+1950-06-15T00:00:00Z', 11))).toBe('1950-06-15');
    });
    it('formats BCE date', () => {
      expect(formatDateValue(wdt('-0500-03-21T00:00:00Z', 11))).toBe('-500-03-21');
    });
    it('formats January 1 as day precision (no heuristic collapse)', () => {
      expect(formatDateValue(wdt('+1950-01-01T00:00:00Z', 11))).toBe('1950-01-01');
    });
  });

  describe('month precision (10)', () => {
    it('formats YYYY-MM', () => {
      expect(formatDateValue(wdt('+1950-06-00T00:00:00Z', 10))).toBe('1950-06');
    });
    it('formats BCE month', () => {
      expect(formatDateValue(wdt('-0500-03-00T00:00:00Z', 10))).toBe('-500-03');
    });
  });

  describe('year precision (9)', () => {
    it('formats YYYY', () => {
      expect(formatDateValue(wdt('+1950-00-00T00:00:00Z', 9))).toBe('1950');
    });
    it('formats January 1 as year when precision=9', () => {
      // This is the correct behaviour when authoritative precision is known
      expect(formatDateValue(wdt('+1950-01-01T00:00:00Z', 9))).toBe('1950');
    });
    it('formats BCE year', () => {
      expect(formatDateValue(wdt('-0500-00-00T00:00:00Z', 9))).toBe('-500');
    });
    it('strips leading zeros from year', () => {
      expect(formatDateValue(wdt('+0050-00-00T00:00:00Z', 9))).toBe('50');
    });
  });

  describe('decade precision (8)', () => {
    it('formats 1950s as 1950er', () => {
      expect(formatDateValue(wdt('+1950-00-00T00:00:00Z', 8))).toBe('1950er');
    });
    it('formats 1820s as 1820er', () => {
      expect(formatDateValue(wdt('+1825-00-00T00:00:00Z', 8))).toBe('1820er');
    });
  });

  describe('century precision (7)', () => {
    it('formats 19th century (year 1850)', () => {
      expect(formatDateValue(wdt('+1850-00-00T00:00:00Z', 7))).toBe('19. Jh.');
    });
    it('formats 20th century (year 1950)', () => {
      expect(formatDateValue(wdt('+1950-00-00T00:00:00Z', 7))).toBe('20. Jh.');
    });
    it('formats 1st century (year 50)', () => {
      expect(formatDateValue(wdt('+0050-00-00T00:00:00Z', 7))).toBe('1. Jh.');
    });
  });

  describe('millennium precision (6)', () => {
    it('formats 2nd millennium (year 1500)', () => {
      expect(formatDateValue(wdt('+1500-00-00T00:00:00Z', 6))).toBe('2. Jt.');
    });
    it('formats 1st millennium (year 500)', () => {
      expect(formatDateValue(wdt('+0500-00-00T00:00:00Z', 6))).toBe('1. Jt.');
    });
  });

  describe('unknown precision', () => {
    it('falls back to year display', () => {
      expect(formatDateValue(wdt('+1950-06-15T00:00:00Z', 4))).toBe('1950');
    });
  });

  it('returns time string unchanged if unparseable', () => {
    expect(formatDateValue({ time: 'invalid', precision: 9, calendarmodel: '' })).toBe('invalid');
  });
});

// ─── dateValueToInputString ───────────────────────────────────────────────────

describe('dateValueToInputString', () => {
  function wdt(time: string, precision: number): WikidataTime {
    return { time, precision, calendarmodel: 'http://www.wikidata.org/entity/Q1985727' };
  }

  it('precision 11 → YYYY-MM-DD', () => {
    expect(dateValueToInputString(wdt('+1950-06-15T00:00:00Z', 11))).toBe('1950-06-15');
  });
  it('precision 10 → YYYY-MM', () => {
    expect(dateValueToInputString(wdt('+1950-06-00T00:00:00Z', 10))).toBe('1950-06');
  });
  it('precision 9 → YYYY', () => {
    expect(dateValueToInputString(wdt('+1950-00-00T00:00:00Z', 9))).toBe('1950');
  });
  it('precision 8 (decade) → YYYY fallback', () => {
    expect(dateValueToInputString(wdt('+1950-00-00T00:00:00Z', 8))).toBe('1950');
  });
  it('precision 7 (century) → YYYY fallback', () => {
    expect(dateValueToInputString(wdt('+1850-00-00T00:00:00Z', 7))).toBe('1850');
  });
  it('handles BCE dates', () => {
    expect(dateValueToInputString(wdt('-0500-03-21T00:00:00Z', 11))).toBe('-500-03-21');
    expect(dateValueToInputString(wdt('-0500-00-00T00:00:00Z', 9))).toBe('-500');
  });
  it('returns empty string for unparseable time', () => {
    expect(dateValueToInputString({ time: 'invalid', precision: 9, calendarmodel: '' })).toBe('');
  });

  describe('round-trip with parseDate', () => {
    it('parseDate(dateValueToInputString(wdt)) matches original', () => {
      const original = parseDate('1950-06-15')!;
      const inputStr = dateValueToInputString(original);
      const reparsed = parseDate(inputStr);
      expect(reparsed?.time).toBe(original.time);
      expect(reparsed?.precision).toBe(original.precision);
    });
  });
});

// ─── formatStatementDate ──────────────────────────────────────────────────────

describe('formatStatementDate', () => {
  function wdt(time: string, precision: number): WikidataTime {
    return { time, precision, calendarmodel: 'http://www.wikidata.org/entity/Q1985727' };
  }

  it('uses the statement value when present', () => {
    expect(formatStatementDate({ value: wdt('+1950-06-15T00:00:00Z', 11) })).toBe('1950-06-15');
  });
  it('prefers the value over qualifiers', () => {
    expect(formatStatementDate({
      value: wdt('+1400-00-00T00:00:00Z', 9),
      latest: wdt('+1409-00-00T00:00:00Z', 9),
    })).toBe('1400');
  });
  it('unknown value with latest → "vor …"', () => {
    // Q140374595: P571 somevalue with P1326 = 1409; WDQS normalises the
    // timestamp to Jan 1 but precision 9 keeps the display at year level
    expect(formatStatementDate({ latest: wdt('1409-01-01T00:00:00Z', 9) })).toBe('vor 1409');
  });
  it('unknown value with earliest → "nach …"', () => {
    expect(formatStatementDate({ earliest: wdt('+1380-00-00T00:00:00Z', 9) })).toBe('nach 1380');
  });
  it('unknown value with both bounds → "zwischen … und …"', () => {
    expect(formatStatementDate({
      earliest: wdt('+1380-00-00T00:00:00Z', 9),
      latest: wdt('+1409-00-00T00:00:00Z', 9),
    })).toBe('zwischen 1380 und 1409');
  });
  it('unknown value without qualifiers → empty string', () => {
    expect(formatStatementDate({})).toBe('');
  });
  it('bounds respect their own precision', () => {
    expect(formatStatementDate({ latest: wdt('+1409-06-00T00:00:00Z', 10) })).toBe('vor 1409-06');
  });
});

// ─── statementDateFromTimeString ──────────────────────────────────────────────

describe('statementDateFromTimeString', () => {
  it('wraps a parseable time string as a value', () => {
    expect(statementDateFromTimeString('+1950-06-15T00:00:00Z')).toEqual({
      value: {
        time: '+1950-06-15T00:00:00Z',
        precision: 11,
        calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
      },
    });
  });
  it('returns undefined for unknown-value skolem IRIs', () => {
    expect(statementDateFromTimeString(
      'http://www.wikidata.org/.well-known/genid/1234abcd',
    )).toBeUndefined();
  });
});
