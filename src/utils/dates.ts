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

/** Signed year of a Wikidata time string, or null if unparseable. */
function signedYear(time: string): number | null {
  const match = time.match(/^([+-]?)(\d{4,})/);
  if (!match) return null;
  return parseInt(match[2], 10) * (match[1] === '-' ? -1 : 1);
}

/**
 * Calendar model for a (possibly edited) date. An explicitly recorded
 * calendar wins over the year-based default rule as long as the year is
 * unchanged — editing the month of a Gregorian-recorded 1580 date must
 * not silently flip it to Julian.
 */
function resolveCalendar(yearNum: number, previous?: WikidataTime): string {
  if (previous && signedYear(previous.time) === yearNum) {
    return previous.calendarmodel;
  }
  return getCalendarModel(yearNum);
}

/**
 * Parse user input into Wikidata time format.
 *
 * Accepted formats (optional +/- prefix on the year everywhere):
 *   YYYY, YYYY-MM, YYYY-MM-DD                    (precision 9/10/11)
 *   1950er, 1950s                                (decade, precision 8)
 *   19. Jh., 19th century                        (century, precision 7)
 *   2. Jt., 2nd millennium                       (millennium, precision 6)
 *
 * Coarse precisions store the Wikidata-conventional representative year:
 * the decade year itself, N*100 for century N, N*1000 for millennium N.
 *
 * `previous` is the value being edited, if any — its calendar model is
 * preserved when the year is unchanged (see resolveCalendar).
 */
export function parseDate(input: string, previous?: WikidataTime): WikidataTime | null {
  if (!input || !input.trim()) return null;

  const trimmed = input.trim();

  const makeTime = (sign: string, yearNum4: string, month: string, day: string, precision: number): WikidataTime => {
    const yearNum = parseInt(yearNum4, 10) * (sign === '-' ? -1 : 1);
    return {
      time: `${sign || '+'}${yearNum4}-${month}-${day}T00:00:00Z`,
      precision,
      calendarmodel: resolveCalendar(yearNum, previous),
    };
  };

  // Match year only: 1950, -500, +1950
  const yearMatch = trimmed.match(/^([+-]?)(\d{1,4})$/);
  if (yearMatch) {
    const [, sign, year] = yearMatch;
    return makeTime(sign, year.padStart(4, '0'), '00', '00', 9);
  }

  // Match year-month: 1950-06, -500-03
  const monthMatch = trimmed.match(/^([+-]?)(\d{1,4})-(\d{2})$/);
  if (monthMatch) {
    const [, sign, year, month] = monthMatch;
    const monthNum = parseInt(month, 10);
    if (monthNum < 1 || monthNum > 12) return null;
    return makeTime(sign, year.padStart(4, '0'), month, '00', 10);
  }

  // Match full date: 1950-06-15, -500-03-21
  const dayMatch = trimmed.match(/^([+-]?)(\d{1,4})-(\d{2})-(\d{2})$/);
  if (dayMatch) {
    const [, sign, year, month, day] = dayMatch;
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    if (monthNum < 1 || monthNum > 12) return null;
    if (dayNum < 1 || dayNum > 31) return null;
    return makeTime(sign, year.padStart(4, '0'), month, day, 11);
  }

  // Match decade: 1950er, 1950s, -500er
  const decadeMatch = trimmed.match(/^([+-]?)(\d{1,4})(?:er|s)$/);
  if (decadeMatch) {
    const [, sign, year] = decadeMatch;
    if (parseInt(year, 10) % 10 !== 0) return null;
    return makeTime(sign, year.padStart(4, '0'), '00', '00', 8);
  }

  // Match century: 19. Jh., 19.Jh, 19th century, -5. Jh.
  const centuryMatch = trimmed.match(/^([+-]?)(\d{1,2})(?:\.|st|nd|rd|th)?\s*(?:Jh\.?|century)$/i);
  if (centuryMatch) {
    const [, sign, century] = centuryMatch;
    const year = String(parseInt(century, 10) * 100).padStart(4, '0');
    return makeTime(sign, year, '00', '00', 7);
  }

  // Match millennium: 2. Jt., 2nd millennium, -1. Jt.
  const millenniumMatch = trimmed.match(/^([+-]?)(\d{1,2})(?:\.|st|nd|rd|th)?\s*(?:Jt\.?|millennium)$/i);
  if (millenniumMatch) {
    const [, sign, millennium] = millenniumMatch;
    const year = String(parseInt(millennium, 10) * 1000).padStart(4, '0');
    return makeTime(sign, year, '00', '00', 6);
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

/** How a StatementDate is being edited in the form. */
export type DateMode = 'value' | 'before' | 'after' | 'between';

/**
 * Editable representation of a StatementDate: a mode plus the raw input
 * strings. Only the strings relevant for the mode are meaningful; the
 * others may hold stale text from a previous mode.
 */
export interface StatementDateEdit {
  mode: DateMode;
  value: string;
  earliest: string;
  latest: string;
}

/** Derive the edit mode and input strings for an existing date. */
export function statementDateToEdit(date?: StatementDate): StatementDateEdit {
  const edit: StatementDateEdit = { mode: 'value', value: '', earliest: '', latest: '' };
  if (!date) return edit;
  // A statement with its own value is edited as that value, even if
  // bounds qualifiers exist (they are preserved on save, see
  // editToStatementDate)
  if (date.value) {
    edit.value = dateValueToInputString(date.value);
    return edit;
  }
  if (date.earliest) edit.earliest = dateValueToInputString(date.earliest);
  if (date.latest) edit.latest = dateValueToInputString(date.latest);
  edit.mode = date.earliest && date.latest ? 'between' : date.earliest ? 'after' : 'before';
  return edit;
}

/**
 * Parse an edit state back into a StatementDate.
 *
 * Returns undefined when the relevant inputs are blank (no date), and
 * null when they are invalid or inconsistent (unparseable text,
 * incomplete "between", earliest after latest).
 *
 * `previous` is the date being edited, if any: each part's calendar
 * model is preserved for unchanged years (see parseDate), and bounds
 * qualifiers of a value statement are carried through untouched when
 * editing in 'value' mode.
 */
export function editToStatementDate(
  edit: StatementDateEdit,
  previous?: StatementDate,
): StatementDate | null | undefined {
  if (edit.mode === 'value') {
    if (!edit.value.trim()) return undefined;
    const value = parseDate(edit.value, previous?.value);
    if (!value) return null;
    if (previous?.value && (previous.earliest || previous.latest)) {
      return { value, earliest: previous.earliest, latest: previous.latest };
    }
    return { value };
  }

  const wantEarliest = edit.mode !== 'before';
  const wantLatest = edit.mode !== 'after';
  const hasEarliest = wantEarliest && !!edit.earliest.trim();
  const hasLatest = wantLatest && !!edit.latest.trim();
  if (!hasEarliest && !hasLatest) return undefined;
  if ((wantEarliest && !hasEarliest) || (wantLatest && !hasLatest)) return null;

  const earliest = hasEarliest ? parseDate(edit.earliest, previous?.earliest) : null;
  const latest = hasLatest ? parseDate(edit.latest, previous?.latest) : null;
  if ((hasEarliest && !earliest) || (hasLatest && !latest)) return null;

  if (earliest && latest) {
    const a = signedYear(earliest.time) ?? 0;
    const b = signedYear(latest.time) ?? 0;
    if (a > b) return null;
  }

  return {
    ...(earliest && { earliest }),
    ...(latest && { latest }),
  };
}

/** Whether any part of the date is recorded in the Julian calendar. */
export function usesJulianCalendar(date: StatementDate): boolean {
  return [date.value, date.earliest, date.latest].some(
    (t) => t?.calendarmodel === PROLEPTIC_JULIAN,
  );
}

/**
 * Convert a WikidataTime to the user-editable input string accepted by
 * parseDate(). Round-trips all supported precisions:
 *
 *   precision 11 → YYYY-MM-DD
 *   precision 10 → YYYY-MM
 *   precision 9  → YYYY
 *   precision 8  → 1950er
 *   precision 7  → 19. Jh.
 *   precision 6  → 2. Jt.
 *   coarser      → YYYY fallback
 *
 * Coarse forms are re-encoded canonically (a 19th-century date stored as
 * 1850 becomes "19. Jh." → year 1900 when saved again).
 */
export function dateValueToInputString(wdt: WikidataTime): string {
  const match = wdt.time.match(/^([+-]?)(\d{4,})-(\d{2})-(\d{2})/);
  if (!match) return '';

  const [, sign, yearStr, month, day] = match;
  const yearNum = parseInt(yearStr, 10);
  const bce = sign === '-' ? '-' : '';
  const displayYear = bce + yearNum;

  switch (wdt.precision) {
    case 11: return `${displayYear}-${month}-${day}`;
    case 10: return `${displayYear}-${month}`;
    // Coarse forms share formatDateValue's localized strings; parseDate
    // accepts every locale's syntax, so this round-trips in any locale
    case 8: case 7: case 6: return formatDateValue(wdt);
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
  if (parseDate(trimmed)) return null;

  // Decade suffix present but the year doesn't end in 0
  if (/^[+-]?\d{1,4}(?:er|s)$/.test(trimmed)) {
    return msg('Jahrzehnt muss auf 0 enden (z.B. 1950er)');
  }

  // Check if it matches any of the expected patterns
  if (!/^[+-]?\d{1,4}(-\d{2}(-\d{2})?)?$/.test(trimmed)) {
    return msg('Format muss YYYY, YYYY-MM, YYYY-MM-DD, "1950er", "19. Jh." oder "2. Jt." sein');
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
