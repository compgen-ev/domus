/**
 * Date utilities for Wikidata time values
 * Supports three formats: YYYY, YYYY-MM, YYYY-MM-DD
 */

export interface WikidataTime {
  time: string;      // ISO format: "+1950-06-15T00:00:00Z"
  precision: number; // 9=year, 10=month, 11=day
  calendarmodel: string;
}

const PROLEPTIC_GREGORIAN = 'http://www.wikidata.org/entity/Q1985727';
const PROLEPTIC_JULIAN = 'http://www.wikidata.org/entity/Q1985786';

/**
 * Get the appropriate calendar model based on year
 * Wikidata convention: Julian before 1583, Gregorian from 1583 onwards
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
 * Format Wikidata time for display/editing
 * Returns: YYYY, YYYY-MM, or YYYY-MM-DD based on precision
 */
export function formatDate(wikidataTime: string): string {
  // Wikidata format: +YYYY-MM-DDT00:00:00Z
  const match = wikidataTime.match(/^([+-]?)(\d{1,4})-(\d{2})-(\d{2})/);
  if (!match) return wikidataTime;

  const [, sign, year, month, day] = match;

  // Remove leading zeros from year (except keep 4 digits for recent dates)
  const yearNum = parseInt(year, 10);
  const displayYear = (sign === '-' ? '-' : '') + yearNum;

  // Year precision (month and day are 00)
  if (month === '00') return displayYear;

  // Month precision (day is 00)
  if (day === '00') return `${displayYear}-${month}`;

  // Check for fake precision (01-01 likely means year-only)
  if (month === '01' && day === '01') return displayYear;

  // Day precision
  return `${displayYear}-${month}-${day}`;
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
    return 'Format muss YYYY, YYYY-MM, oder YYYY-MM-DD sein';
  }

  // Try to parse and check for logical errors
  const monthMatch = trimmed.match(/-(\d{2})(?:-|$)/);
  if (monthMatch) {
    const month = parseInt(monthMatch[1], 10);
    if (month < 1 || month > 12) {
      return 'Monat muss zwischen 01 und 12 liegen';
    }
  }

  const dayMatch = trimmed.match(/-\d{2}-(\d{2})$/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);
    if (day < 1 || day > 31) {
      return 'Tag muss zwischen 01 und 31 liegen';
    }
  }

  return null;
}
