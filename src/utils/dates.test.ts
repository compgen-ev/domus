import { describe, it, expect } from 'vitest';
import {
  parseDate,
  formatDate,
  formatDateValue,
  wikidataTimeStringToValue,
  dateValueToInputString,
  formatStatementDate,
  statementDateFromTimeString,
  statementDateToEdit,
  editToStatementDate,
  usesJulianCalendar,
  isValidDateInput,
  getDateValidationError,
  type WikidataTime,
  type StatementDate,
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
  it('precision 8 (decade) → decade form', () => {
    expect(dateValueToInputString(wdt('+1950-00-00T00:00:00Z', 8))).toBe('1950er');
  });
  it('precision 7 (century) → century form', () => {
    expect(dateValueToInputString(wdt('+1850-00-00T00:00:00Z', 7))).toBe('19. Jh.');
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

// ─── coarse-precision input (decade / century / millennium) ──────────────────

describe('parseDate coarse precisions', () => {
  const GREGORIAN = 'http://www.wikidata.org/entity/Q1985727';
  const JULIAN = 'http://www.wikidata.org/entity/Q1985786';

  describe('decade (precision 8)', () => {
    it('parses German decade "1950er"', () => {
      expect(parseDate('1950er')).toEqual({
        time: '+1950-00-00T00:00:00Z',
        precision: 8,
        calendarmodel: GREGORIAN,
      });
    });
    it('parses English decade "1950s"', () => {
      expect(parseDate('1950s')?.precision).toBe(8);
      expect(parseDate('1950s')?.time).toBe('+1950-00-00T00:00:00Z');
    });
    it('parses pre-1583 decade as Julian', () => {
      expect(parseDate('1400er')?.calendarmodel).toBe(JULIAN);
    });
    it('parses BCE decade', () => {
      expect(parseDate('-500er')).toEqual({
        time: '-0500-00-00T00:00:00Z',
        precision: 8,
        calendarmodel: JULIAN,
      });
    });
    it('rejects a decade not ending in 0', () => {
      expect(parseDate('1953er')).toBeNull();
    });
  });

  describe('century (precision 7)', () => {
    it('parses German century "19. Jh." to Wikidata convention year N*100', () => {
      expect(parseDate('19. Jh.')).toEqual({
        time: '+1900-00-00T00:00:00Z',
        precision: 7,
        calendarmodel: GREGORIAN,
      });
    });
    it('accepts missing trailing dot and tight spacing', () => {
      expect(parseDate('19.Jh')?.precision).toBe(7);
      expect(parseDate('19. Jh')?.time).toBe('+1900-00-00T00:00:00Z');
    });
    it('parses the English emission forms "19. century" / "2. millennium"', () => {
      // dateValueToInputString emits these via the localized formatter;
      // the parser must accept them in any locale
      expect(parseDate('19. century')?.precision).toBe(7);
      expect(parseDate('2. millennium')?.precision).toBe(6);
    });
    it('parses English ordinal century "19th century"', () => {
      expect(parseDate('19th century')?.time).toBe('+1900-00-00T00:00:00Z');
      expect(parseDate('19th century')?.precision).toBe(7);
    });
    it('parses "15. Jh." as Julian (year 1500 < 1583)', () => {
      expect(parseDate('15. Jh.')).toEqual({
        time: '+1500-00-00T00:00:00Z',
        precision: 7,
        calendarmodel: JULIAN,
      });
    });
    it('parses BCE century "-5. Jh."', () => {
      expect(parseDate('-5. Jh.')).toEqual({
        time: '-0500-00-00T00:00:00Z',
        precision: 7,
        calendarmodel: JULIAN,
      });
    });
  });

  describe('millennium (precision 6)', () => {
    it('parses German millennium "2. Jt." to year N*1000', () => {
      expect(parseDate('2. Jt.')).toEqual({
        time: '+2000-00-00T00:00:00Z',
        precision: 6,
        calendarmodel: GREGORIAN,
      });
    });
    it('parses English "2nd millennium"', () => {
      expect(parseDate('2nd millennium')?.precision).toBe(6);
      expect(parseDate('2nd millennium')?.time).toBe('+2000-00-00T00:00:00Z');
    });
    it('parses BCE millennium "-1. Jt."', () => {
      expect(parseDate('-1. Jt.')).toEqual({
        time: '-1000-00-00T00:00:00Z',
        precision: 6,
        calendarmodel: JULIAN,
      });
    });
  });

  describe('round-trips', () => {
    it.each(['1950er', '19. Jh.', '2. Jt.', '-5. Jh.', '1400er'])(
      'dateValueToInputString(parseDate(%j)) is identity',
      (input) => {
        expect(dateValueToInputString(parseDate(input)!)).toBe(input);
      },
    );
    it('formatDateValue agrees with input for decade', () => {
      expect(formatDateValue(parseDate('1950er')!)).toBe('1950er');
    });
    it('formatDateValue agrees with input for century', () => {
      expect(formatDateValue(parseDate('19. Jh.')!)).toBe('19. Jh.');
    });
    it('normalises non-canonical stored years on re-encode', () => {
      // Wikidata items store e.g. 1850 or 1801 for the 19th century
      const stored: WikidataTime = {
        time: '+1850-00-00T00:00:00Z',
        precision: 7,
        calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
      };
      expect(dateValueToInputString(stored)).toBe('19. Jh.');
    });
  });
});

// ─── calendar model preservation ──────────────────────────────────────────────

describe('parseDate calendar preservation', () => {
  const GREGORIAN = 'http://www.wikidata.org/entity/Q1985727';
  const JULIAN = 'http://www.wikidata.org/entity/Q1985786';

  it('keeps the previous calendar when the year is unchanged', () => {
    // A 1580 date explicitly recorded in Gregorian must not silently
    // flip to Julian when the user edits only month/day
    const previous: WikidataTime = {
      time: '+1580-06-15T00:00:00Z',
      precision: 11,
      calendarmodel: GREGORIAN,
    };
    expect(parseDate('1580-07-01', previous)?.calendarmodel).toBe(GREGORIAN);
    expect(parseDate('1580', previous)?.calendarmodel).toBe(GREGORIAN);
  });

  it('re-derives the calendar when the year changes', () => {
    const previous: WikidataTime = {
      time: '+1580-06-15T00:00:00Z',
      precision: 11,
      calendarmodel: GREGORIAN,
    };
    expect(parseDate('1590', previous)?.calendarmodel).toBe(GREGORIAN);
    expect(parseDate('1500', previous)?.calendarmodel).toBe(JULIAN);
  });

  it('distinguishes BCE from CE years of the same magnitude', () => {
    const previous: WikidataTime = {
      time: '-0500-00-00T00:00:00Z',
      precision: 9,
      calendarmodel: GREGORIAN, // unusual, but explicitly recorded
    };
    expect(parseDate('-500', previous)?.calendarmodel).toBe(GREGORIAN);
    expect(parseDate('500', previous)?.calendarmodel).toBe(JULIAN);
  });

  it('works without a previous value (unchanged default rule)', () => {
    expect(parseDate('1580')?.calendarmodel).toBe(JULIAN);
  });
});

// ─── validation for coarse formats ────────────────────────────────────────────

describe('getDateValidationError coarse formats', () => {
  it('accepts valid coarse inputs', () => {
    expect(getDateValidationError('1950er')).toBeNull();
    expect(getDateValidationError('19. Jh.')).toBeNull();
    expect(getDateValidationError('2. Jt.')).toBeNull();
  });
  it('explains the decade multiple-of-10 rule', () => {
    expect(getDateValidationError('1953er')).toContain('Jahrzehnt');
  });
  it('still reports month/day errors', () => {
    expect(getDateValidationError('1950-13')).toContain('Monat');
    expect(getDateValidationError('1950-06-32')).toContain('Tag');
  });
  it('rejects garbage with a format hint', () => {
    expect(getDateValidationError('not a date')).toContain('Format');
  });
});

// ─── StatementDateEdit (structured edit state) ───────────────────────────────

describe('statementDateToEdit / editToStatementDate', () => {
  const GREGORIAN = 'http://www.wikidata.org/entity/Q1985727';
  const JULIAN = 'http://www.wikidata.org/entity/Q1985786';
  function wdt(time: string, precision: number, cal = GREGORIAN): WikidataTime {
    return { time, precision, calendarmodel: cal };
  }

  describe('statementDateToEdit', () => {
    it('maps absent date to empty exact mode', () => {
      expect(statementDateToEdit(undefined)).toEqual({ mode: 'value', value: '', earliest: '', latest: '' });
    });
    it('maps a plain value to exact mode', () => {
      expect(statementDateToEdit({ value: wdt('+1950-06-00T00:00:00Z', 10) })).toEqual({
        mode: 'value', value: '1950-06', earliest: '', latest: '',
      });
    });
    it('maps latest-only to before mode', () => {
      expect(statementDateToEdit({ latest: wdt('+1409-00-00T00:00:00Z', 9, JULIAN) })).toEqual({
        mode: 'before', value: '', earliest: '', latest: '1409',
      });
    });
    it('maps earliest-only to after mode', () => {
      expect(statementDateToEdit({ earliest: wdt('+1380-00-00T00:00:00Z', 9, JULIAN) })).toEqual({
        mode: 'after', value: '', earliest: '1380', latest: '',
      });
    });
    it('maps both bounds to between mode', () => {
      expect(statementDateToEdit({
        earliest: wdt('+1380-00-00T00:00:00Z', 9, JULIAN),
        latest: wdt('+1409-00-00T00:00:00Z', 9, JULIAN),
      })).toEqual({ mode: 'between', value: '', earliest: '1380', latest: '1409' });
    });
    it('a value with bounds qualifiers still edits as exact', () => {
      expect(statementDateToEdit({
        value: wdt('+1400-00-00T00:00:00Z', 9, JULIAN),
        latest: wdt('+1409-00-00T00:00:00Z', 9, JULIAN),
      }).mode).toBe('value');
    });
    it('uses coarse input forms', () => {
      expect(statementDateToEdit({ value: wdt('+1900-00-00T00:00:00Z', 7) }).value).toBe('19. Jh.');
    });
  });

  describe('editToStatementDate', () => {
    it('returns undefined for an entirely blank exact edit', () => {
      expect(editToStatementDate({ mode: 'value', value: '', earliest: '', latest: '' })).toBeUndefined();
    });
    it('parses exact mode', () => {
      expect(editToStatementDate({ mode: 'value', value: '1950-06', earliest: '', latest: '' })).toEqual({
        value: wdt('+1950-06-00T00:00:00Z', 10),
      });
    });
    it('parses before mode, ignoring stale other fields', () => {
      expect(editToStatementDate({ mode: 'before', value: '1950', earliest: '1300', latest: '1409' })).toEqual({
        latest: wdt('+1409-00-00T00:00:00Z', 9, JULIAN),
      });
    });
    it('parses after mode', () => {
      expect(editToStatementDate({ mode: 'after', value: '', earliest: '1380', latest: '' })).toEqual({
        earliest: wdt('+1380-00-00T00:00:00Z', 9, JULIAN),
      });
    });
    it('parses between mode', () => {
      expect(editToStatementDate({ mode: 'between', value: '', earliest: '1380', latest: '1409' })).toEqual({
        earliest: wdt('+1380-00-00T00:00:00Z', 9, JULIAN),
        latest: wdt('+1409-00-00T00:00:00Z', 9, JULIAN),
      });
    });
    it('returns null for invalid input', () => {
      expect(editToStatementDate({ mode: 'value', value: 'garbage', earliest: '', latest: '' })).toBeNull();
    });
    it('returns null for incomplete between', () => {
      expect(editToStatementDate({ mode: 'between', value: '', earliest: '1380', latest: '' })).toBeNull();
    });
    it('returns null when earliest is after latest', () => {
      expect(editToStatementDate({ mode: 'between', value: '', earliest: '1450', latest: '1409' })).toBeNull();
    });
    it('accepts equal-year bounds', () => {
      expect(editToStatementDate({ mode: 'between', value: '', earliest: '1409', latest: '1409' })).not.toBeNull();
    });
    it('orders BCE before CE bounds correctly', () => {
      expect(editToStatementDate({ mode: 'between', value: '', earliest: '-100', latest: '100' })).not.toBeNull();
      expect(editToStatementDate({ mode: 'between', value: '', earliest: '100', latest: '-100' })).toBeNull();
    });
    it('preserves the previous calendar for an unchanged year', () => {
      const previous: StatementDate = { value: wdt('+1580-06-15T00:00:00Z', 11, GREGORIAN) };
      const result = editToStatementDate(
        { mode: 'value', value: '1580-07', earliest: '', latest: '' },
        previous,
      );
      expect(result?.value?.calendarmodel).toBe(GREGORIAN);
    });
    it('preserves the previous calendar per bound', () => {
      const previous: StatementDate = { latest: wdt('+1409-00-00T00:00:00Z', 9, GREGORIAN) };
      const result = editToStatementDate(
        { mode: 'before', value: '', earliest: '', latest: '1409-06' },
        previous,
      );
      expect(result?.latest?.calendarmodel).toBe(GREGORIAN);
    });
    it('keeps bounds qualifiers of a value statement untouched in exact mode', () => {
      const previous: StatementDate = {
        value: wdt('+1400-00-00T00:00:00Z', 9, JULIAN),
        latest: wdt('+1409-00-00T00:00:00Z', 9, JULIAN),
      };
      const result = editToStatementDate(
        { mode: 'value', value: '1401', earliest: '', latest: '' },
        previous,
      );
      expect(result?.value?.time).toBe('+1401-00-00T00:00:00Z');
      expect(result?.latest).toEqual(previous.latest);
    });
  });

  describe('round-trip', () => {
    it.each<StatementDate>([
      { value: wdt('+1950-06-15T00:00:00Z', 11) },
      { value: wdt('+1900-00-00T00:00:00Z', 7) },
      { latest: wdt('+1409-00-00T00:00:00Z', 9, JULIAN) },
      { earliest: wdt('+1380-00-00T00:00:00Z', 9, JULIAN) },
      { earliest: wdt('+1380-00-00T00:00:00Z', 9, JULIAN), latest: wdt('+1409-00-00T00:00:00Z', 9, JULIAN) },
    ])('editToStatementDate(statementDateToEdit(d), d) === d', (d) => {
      expect(editToStatementDate(statementDateToEdit(d), d)).toEqual(d);
    });
  });
});

describe('usesJulianCalendar', () => {
  const JULIAN = 'http://www.wikidata.org/entity/Q1985786';
  const GREGORIAN = 'http://www.wikidata.org/entity/Q1985727';
  it('detects Julian in any part', () => {
    expect(usesJulianCalendar({ latest: { time: '+1409-00-00T00:00:00Z', precision: 9, calendarmodel: JULIAN } })).toBe(true);
    expect(usesJulianCalendar({ value: { time: '+1950-00-00T00:00:00Z', precision: 9, calendarmodel: GREGORIAN } })).toBe(false);
  });
});
