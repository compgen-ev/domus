/**
 * Date utilities for Wikidata time values
 * Supports three formats: YYYY, YYYY-MM, YYYY-MM-DD
 */

import { msg, str } from '@lit/localize';

export interface WikidataTime {
  time: string;      // Wikidata internal format: "+1950-06-15T00:00:00Z"
  precision: number; // 9=year, 10=month, 11=day, 8=decade, 7=century, 6=millennium
  calendarmodel: string; // URI, e.g. http://www.wikidata.org/entity/Q1985727
}

/**
 * A date as recorded on a Wikidata statement (e.g. P571 inception).
 *
 * `value` is the statement's own time value. Wikidata also allows an
 * "unknown value" (somevalue) statement bracketed by qualifiers — in that
 * case `value` is absent and `earliest` (P1319) and/or `latest` (P1326)
 * carry the known bounds ("built before 1409").
 */
export interface StatementDate {
  value?: WikidataTime;
  /** P1319 "earliest date" qualifier. */
  earliest?: WikidataTime;
  /** P1326 "latest date" qualifier. */
  latest?: WikidataTime;
}

export const PROLEPTIC_GREGORIAN = 'http://www.wikidata.org/entity/Q1985727';
export const PROLEPTIC_JULIAN = 'http://www.wikidata.org/entity/Q1985786';

/**
 * Get the appropriate calendar model based on year.
 * Wikidata convention: Julian before 1583, Gregorian from 1583 onwards.
 */
function getCalendarModel(year: number): string {
  return year < 1583 ? PROLEPTIC_JULIAN : PROLEPTIC_GREGORIAN;
}

/**
 * Parse user input into Wikidata time format
 * Accepts: YYYY, YYYY-MM, YYYY-MM-DD (with optional +/- prefix)
 */
export function parseDate(input: string): WikidataTime | null {
  if (!input || !input.trim()) return null;

  const trimmed = input.trim();

  // Match year only: 1950, -500, +1950
  const yearMatch = trimmed.match(/^([+-]?)(\d{1,4})$/);
  if (yearMatch) {
    const [, sign, year] = yearMatch;
    const paddedYear = year.padStart(4, '0');
    const yearNum = parseInt(year, 10) * (sign === '-' ? -1 : 1);
    return {
      time: `${sign || '+'}${paddedYear}-00-00T00:00:00Z`,
      precision: 9,
      calendarmodel: getCalendarModel(yearNum),
    };
  }

  // Match year-month: 1950-06, -500-03
  const monthMatch = trimmed.match(/^([+-]?)(\d{1,4})-(\d{2})$/);
  if (monthMatch) {
    const [, sign, year, month] = monthMatch;
    const paddedYear = year.padStart(4, '0');
    const monthNum = parseInt(month, 10);
    if (monthNum < 1 || monthNum > 12) return null;
    const yearNum = parseInt(year, 10) * (sign === '-' ? -1 : 1);
    return {
      time: `${sign || '+'}${paddedYear}-${month}-00T00:00:00Z`,
      precision: 10,
      calendarmodel: getCalendarModel(yearNum),
    };
  }

  // Match full date: 1950-06-15, -500-03-21
  const dayMatch = trimmed.match(/^([+-]?)(\d{1,4})-(\d{2})-(\d{2})$/);
  if (dayMatch) {
    const [, sign, year, month, day] = dayMatch;
    const paddedYear = year.padStart(4, '0');
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    if (monthNum < 1 || monthNum > 12) return null;
    if (dayNum < 1 || dayNum > 31) return null;
    const yearNum = parseInt(year, 10) * (sign === '-' ? -1 : 1);
    return {
      time: `${sign || '+'}${paddedYear}-${month}-${day}T00:00:00Z`,
      precision: 11,
      calendarmodel: getCalendarModel(yearNum),
    };
  }

  return null;
}

/**
 * Parse a Wikidata internal time string into a WikidataTime value.
 *
 * Precision is inferred from the 00-placeholder convention used in the
 * Wikidata JSON/SPARQL format:
 *   month === '00'  →  precision 9  (year)
 *   day   === '00'  →  precision 10 (month)
 *   otherwise       →  precision 11 (day)
 *
 * Limitation: when dates are fetched via SPARQL `wdt:` shortcuts, the
 * endpoint may normalise year-precision dates to January 1 and
 * month-precision dates to the 1st of the month. In those cases the
 * inferred precision will be over-specific (11 instead of 9 or 10).
 * Use psv:-based SPARQL bindings to get authoritative precision.
 */
export function wikidataTimeStringToValue(timeStr: string): WikidataTime | null {
  const match = timeStr.match(/^([+-]?)(\d{4,})-(\d{2})-(\d{2})T/);
  if (!match) return null;

  const [, sign, yearStr, month, day] = match;
  const yearNum = parseInt(yearStr, 10) * (sign === '-' ? -1 : 1);

  let precision: number;
  if (month === '00') {
    precision = 9;
  } else if (day === '00') {
    precision = 10;
  } else {
    precision = 11;
  }

  return {
    time: timeStr,
    precision,
    calendarmodel: getCalendarModel(yearNum),
  };
}

/**
 * Format a WikidataTime for human display using its precision field.
 *
 * | precision | example output   | meaning     |
 * |-----------|------------------|-------------|
 * |        11 | 1950-06-15       | day         |
 * |        10 | 1950-06          | month       |
 * |         9 | 1950             | year        |
 * |         8 | 1950er           | decade      |
 * |         7 | 20. Jh.          | century     |
 * |         6 | 2. Jt.           | millennium  |
 * |      other| 1950             | year part   |
 *
 * BCE years are prefixed with '-'. Century/decade labels are localized
 * via @lit/localize (German source, e.g. "20. Jh." → "20th century").
 */
export function formatDateValue(wdt: WikidataTime): string {
  const match = wdt.time.match(/^([+-]?)(\d{4,})-(\d{2})-(\d{2})/);
  if (!match) return wdt.time;

  const [, sign, yearStr, month, day] = match;
  const yearNum = parseInt(yearStr, 10);
  const isBCE = sign === '-';
  const displayYear = (isBCE ? '-' : '') + yearNum;

  switch (wdt.precision) {
    case 11: // day
      return `${displayYear}-${month}-${day}`;
    case 10: // month
      return `${displayYear}-${month}`;
    case 9: // year
      return displayYear;
    case 8: { // decade
      const decade = `${isBCE ? '-' : ''}${Math.floor(yearNum / 10) * 10}`;
      return msg(str`${decade}er`);
    }
    case 7: { // century (strict: years 1–100 = 1st, 101–200 = 2nd, …)
      const century = `${isBCE ? '-' : ''}${Math.ceil(yearNum / 100)}`;
      return msg(str`${century}. Jh.`);
    }
    case 6: { // millennium
      const millennium = `${isBCE ? '-' : ''}${Math.ceil(yearNum / 1000)}`;
      return msg(str`${millennium}. Jt.`);
    }
    default:
      return displayYear;
  }
}

/**
 * Format a StatementDate for human display.
 *
 * A statement with its own value formats like formatDateValue(). An
 * unknown-value statement falls back to its earliest/latest qualifiers:
 *
 *   latest only        → "vor 1409"
 *   earliest only      → "nach 1380"
 *   earliest + latest  → "zwischen 1380 und 1409"
 *
 * Returns '' when nothing displayable is present (unknown value without
 * qualifiers). Strings are localized via @lit/localize.
 */
export function formatStatementDate(date: StatementDate): string {
  if (date.value) return formatDateValue(date.value);

  const earliest = date.earliest ? formatDateValue(date.earliest) : null;
  const latest = date.latest ? formatDateValue(date.latest) : null;
  if (earliest && latest) return msg(str`zwischen ${earliest} und ${latest}`);
  if (latest) return msg(str`vor ${latest}`);
  if (earliest) return msg(str`nach ${earliest}`);
  return '';
}

/**
 * Build a StatementDate from a bare Wikidata time string (precision
 * inferred from 00-placeholders, see wikidataTimeStringToValue). Returns
 * undefined for non-time strings such as unknown-value skolem IRIs that
 * `wdt:` SPARQL shortcuts produce.
 */
export function statementDateFromTimeString(timeStr: string): StatementDate | undefined {
  const value = wikidataTimeStringToValue(timeStr);
  return value ? { value } : undefined;
}

/**
 * Convert a WikidataTime to the user-editable input string accepted by
 * parseDate(). Coarser-than-year precisions fall back to the year.
 *
 *   precision 11 → YYYY-MM-DD
 *   precision 10 → YYYY-MM
 *   precision ≤9 → YYYY
 */
export function dateValueToInputString(wdt: WikidataTime): string {
  const match = wdt.time.match(/^([+-]?)(\d{4,})-(\d{2})-(\d{2})/);
  if (!match) return '';

  const [, sign, yearStr, month, day] = match;
  const yearNum = parseInt(yearStr, 10);
  const displayYear = (sign === '-' ? '-' : '') + yearNum;

  switch (wdt.precision) {
    case 11: return `${displayYear}-${month}-${day}`;
    case 10: return `${displayYear}-${month}`;
    default:  return displayYear;
  }
}

/**
 * Format a Wikidata time string for display/editing.
 * Precision is inferred from 00-placeholders in the string only.
 * Returns: YYYY, YYYY-MM, or YYYY-MM-DD.
 *
 * @deprecated Prefer {@link formatDateValue} when a WikidataTime with an
 * explicit precision field is available. This function cannot distinguish a
 * genuine January 1 day-precision date from a year-precision date that the
 * SPARQL endpoint has normalised to January 1.
 */
export function formatDate(wikidataTime: string): string {
  const match = wikidataTime.match(/^([+-]?)(\d{1,4})-(\d{2})-(\d{2})/);
  if (!match) return wikidataTime;

  const [, sign, year, month, day] = match;
  const yearNum = parseInt(year, 10);
  const displayYear = (sign === '-' ? '-' : '') + yearNum;

  if (month === '00') return displayYear;                    // year precision
  if (day === '00') return `${displayYear}-${month}`;       // month precision
  return `${displayYear}-${month}-${day}`;                  // day precision
}

/**
 * Validate date input format
 */
export function isValidDateInput(input: string): boolean {
  return parseDate(input) !== null;
}

/**
 * Get human-readable error for invalid date
 */
export function getDateValidationError(input: string): string | null {
  if (!input || !input.trim()) return null;

  const trimmed = input.trim();

  // Check if it matches any of the expected patterns
  if (!/^[+-]?\d{1,4}(-\d{2}(-\d{2})?)?$/.test(trimmed)) {
    return msg('Format muss YYYY, YYYY-MM, oder YYYY-MM-DD sein');
  }

  // Try to parse and check for logical errors
  const monthMatch = trimmed.match(/-(\d{2})(?:-|$)/);
  if (monthMatch) {
    const month = parseInt(monthMatch[1], 10);
    if (month < 1 || month > 12) {
      return msg('Monat muss zwischen 01 und 12 liegen');
    }
  }

  const dayMatch = trimmed.match(/-\d{2}-(\d{2})$/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);
    if (day < 1 || day > 31) {
      return msg('Tag muss zwischen 01 und 31 liegen');
    }
  }

  return null;
}
