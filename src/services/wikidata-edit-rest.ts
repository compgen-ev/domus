/**
 * Wikidata REST API client for editing building entities
 *
 * API Documentation & OpenAPI Spec:
 * https://www.wikidata.org/w/rest.php/wikibase/v1/openapi.json
 *
 * Schema reference:
 * - Statement: .components.schemas.Statement
 * - Reference: .components.schemas.Statement.properties.references.items
 * - Value types: "value", "somevalue", "novalue"
 */

import type { WikidataItem } from '../types/building';
import { getValidAccessToken } from './wikimedia-auth';
import { parseDate, type StatementDate, type WikidataTime } from '../utils/dates';
import { recordEdit } from './edit-tracker';
import { getLocale } from '../locale';
import { normalizeAliases } from '../utils/aliases';
import { msg, str } from '@lit/localize';

const WIKIDATA_REST_API = 'https://www.wikidata.org/w/rest.php/wikibase/v1';

/**
 * Reference to an online source.
 * - P854 reference URL, or P4656 Wikimedia import URL for Wikimedia projects
 * - P1476 title (monolingual text), optional
 * - P304 page(s), optional
 */
export interface UrlSource {
  type: 'url';
  url: string;
  title?: string;      // P1476
  titleLanguage?: string;
  page?: string;       // P304
}

/**
 * Reference to an archival document.
 * - P485 archive (wikibase-item)
 * - P217 inventory number / Signatur
 * - P304 page(s), optional
 */
export interface ArchiveSource {
  type: 'archive';
  archive: WikidataItem; // P485
  callNumber: string;    // P217
  page?: string;         // P304
}

/**
 * Reference to a book by its Wikidata item.
 * - P248 stated in (wikibase-item)
 * - P304 page(s), optional
 */
export interface BookSourceItem {
  type: 'book';
  mode: 'item';
  book: WikidataItem; // P248
  page?: string;      // P304
}

/**
 * Reference to a book without a Wikidata item (free-text fallback).
 * - P1476 title (monolingual text)
 * - P2093 author name string, optional
 * - P577 publication date (year only), optional
 * - P304 page(s), optional
 */
export interface BookSourceFreeText {
  type: 'book';
  mode: 'freetext';
  title: string;         // P1476
  titleLanguage: string;
  author?: string;       // P2093
  year?: string;         // P577
  page?: string;         // P304
}

export type BookSource = BookSourceItem | BookSourceFreeText;

export type SourceRef = UrlSource | ArchiveSource | BookSource;

export interface BuildingEditData {
  id: string;
  label?: string;
  aliases?: string;
  type?: WikidataItem;
  inception?: StatementDate;
  demolished?: StatementDate;
  /**
   * Set when `type`, `inception` or `demolished` repeats the item's current
   * value so the source can be added to it. The statement must then already
   * exist; the edit fails rather than replacing anything.
   */
  citeType?: boolean;
  citeInception?: boolean;
  citeDemolished?: boolean;
  /**
   * Commons filename (without `File:`) for the building's image (P18). It
   * replaces any current image and needs no source: the file page on
   * Commons documents it.
   */
  image?: string;
  address?: string;
  /** Language code of the address text (P6375 is monolingual text). */
  addressLanguage?: string;
  addressStartDate?: string;
  addressEndDate?: string;
  architect?: WikidataItem;
  commissionedBy?: WikidataItem;
  owner?: WikidataItem;
  ownerStartDate?: string;
  ownerEndDate?: string;
  occupant?: WikidataItem;
  occupantStartDate?: string;
  occupantEndDate?: string;
  source?: SourceRef;
}

/**
 * Validates edit data before submission
 */
export function validateEditData(data: BuildingEditData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.id) {
    errors.push('Building ID is required');
  } else if (!data.id.match(/^Q\d+$/)) {
    errors.push('Building ID must be in format Q123');
  }

  if (data.label !== undefined && data.label.trim() === '') {
    errors.push('Label cannot be empty');
  }

  if (data.type && !data.type.id.match(/^Q\d+$/)) {
    errors.push('Building type ID must be in format Q123');
  }

  if (data.inception && !data.inception.value && !data.inception.earliest && !data.inception.latest) {
    errors.push('Inception date is empty');
  }

  if (data.demolished && !data.demolished.value && !data.demolished.earliest && !data.demolished.latest) {
    errors.push('Demolished date is empty');
  }

  if (data.image !== undefined && (!data.image.trim() || /[#<>[\]|{}]|^file:/i.test(data.image))) {
    errors.push('Image must be a Commons filename without the File: prefix');
  }

  if (data.address && !data.addressLanguage) {
    errors.push('Address language is required');
  }

  if ((data.citeType && !data.type) || (data.citeInception && !data.inception) || (data.citeDemolished && !data.demolished)) {
    errors.push('A value to cite is missing');
  }

  // Check if there are any non-empty changes to claims
  const hasClaimChanges = (data.type !== undefined) ||
                          (data.inception !== undefined) ||
                          (data.demolished !== undefined) ||
                          (data.address !== undefined && data.address !== '') ||
                          (data.architect !== undefined) ||
                          (data.commissionedBy !== undefined) ||
                          (data.owner !== undefined) ||
                          (data.occupant !== undefined);

  if (hasClaimChanges && !data.source) {
    errors.push('Source is required when editing building data');
  }

  if (data.source) {
    if (data.source.type === 'url') {
      try {
        new URL(data.source.url);
      } catch {
        errors.push('Source URL must be a valid URL');
      }
    } else if (data.source.type === 'archive') {
      if (!data.source.archive?.id?.match(/^Q\d+$/)) {
        errors.push('Archive must be a valid Wikidata item');
      }
      if (!data.source.callNumber.trim()) {
        errors.push('Archive call number (Signatur) is required');
      }
    } else {
      // book
      if (data.source.mode === 'item') {
        if (!data.source.book?.id?.match(/^Q\d+$/)) {
          errors.push('Book must be a valid Wikidata item');
        }
      } else {
        if (!data.source.title.trim()) {
          errors.push('Book title is required');
        }
        if (data.source.year && !data.source.year.match(/^\d{4}$/)) {
          errors.push('Book year must be a 4-digit year');
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a statement value for different data types
 */
function createStatementValue(value: string | WikidataItem, type: 'string' | 'time' | 'wikibase-item') {
  if (type === 'string') {
    return { type: 'value', content: value as string };
  } else if (type === 'time') {
    const parsed = parseDate(value as string);
    if (!parsed) {
      throw new Error(`Invalid date format: ${value}`);
    }
    return {
      type: 'value',
      content: {
        time: parsed.time,
        precision: parsed.precision,
        calendarmodel: parsed.calendarmodel,
      },
    };
  } else if (type === 'wikibase-item') {
    const item = value as WikidataItem;
    return { type: 'value', content: item.id };
  }
}

function createTimeContent(t: WikidataTime) {
  return {
    type: 'value',
    content: { time: t.time, precision: t.precision, calendarmodel: t.calendarmodel },
  };
}

/**
 * Builds a REST API statement for a time property. A date without a value
 * becomes an unknown-value (somevalue) statement; earliest/latest bounds
 * become P1319/P1326 qualifiers.
 */
export function createDateStatement(prop: string, date: StatementDate, source?: SourceRef) {
  const qualifiers: Array<{ property: { id: string }; value: ReturnType<typeof createTimeContent> }> = [];
  if (date.earliest) qualifiers.push({ property: { id: 'P1319' }, value: createTimeContent(date.earliest) });
  if (date.latest) qualifiers.push({ property: { id: 'P1326' }, value: createTimeContent(date.latest) });
  return {
    property: { id: prop },
    value: date.value ? createTimeContent(date.value) : { type: 'somevalue' },
    ...(qualifiers.length > 0 && { qualifiers }),
    ...(source && { references: [createReference(source)] }),
  };
}

function timeContentMatches(value: any, t: WikidataTime): boolean {
  return value?.type === 'value'
    && value?.content?.time === t.time
    && value?.content?.precision === t.precision;
}

/**
 * Whether an existing REST API statement already records exactly this
 * date (value or somevalue, including its earliest/latest qualifiers) —
 * in that case only a reference is added instead of replacing it.
 */
export function dateStatementMatches(stmt: any, date: StatementDate): boolean {
  const valueMatches = date.value
    ? timeContentMatches(stmt.value, date.value)
    : stmt.value?.type === 'somevalue';
  if (!valueMatches) return false;

  const qualifierMatches = (prop: string, t?: WikidataTime) => {
    const quals = (stmt.qualifiers ?? []).filter((q: any) => q.property?.id === prop);
    if (!t) return quals.length === 0;
    return quals.some((q: any) => timeContentMatches(q.value, t));
  };
  return qualifierMatches('P1319', date.earliest) && qualifierMatches('P1326', date.latest);
}

/**
 * Builds a Wikidata REST API reference object from a SourceRef.
 */
type ReferencePart = { property: { id: string }; value: { type: string; content: unknown } };

/** Hostname suffix of any Wikimedia Foundation project wiki. Sources pointing here use
 * P4656 (Wikimedia import URL) instead of P854 (reference URL). See compgen-ev/domus#10. */
const WIKIMEDIA_HOSTNAME =
  /\.(wikipedia|wiktionary|wikibooks|wikinews|wikiquote|wikisource|wikiversity|wikivoyage|wikidata|wikimedia)\.org$/i;

function isWikimediaUrl(url: string): boolean {
  try {
    return WIKIMEDIA_HOSTNAME.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function createReference(source: SourceRef) {
  if (source.type === 'url') {
    const urlProperty = isWikimediaUrl(source.url) ? 'P4656' : 'P854';
    const parts: ReferencePart[] = [
      { property: { id: urlProperty }, value: { type: 'value', content: source.url } },
    ];
    if (source.title) {
      parts.push({ property: { id: 'P1476' }, value: { type: 'value', content: { text: source.title, language: source.titleLanguage } } });
    }
    if (source.page) {
      parts.push({ property: { id: 'P304' }, value: { type: 'value', content: source.page } });
    }
    return { parts };
  } else if (source.type === 'archive') {
    const parts: ReferencePart[] = [
      { property: { id: 'P485' }, value: { type: 'value', content: source.archive.id } },
      { property: { id: 'P217' }, value: { type: 'value', content: source.callNumber } },
    ];
    if (source.page) {
      parts.push({ property: { id: 'P304' }, value: { type: 'value', content: source.page } });
    }
    return { parts };
  } else if (source.mode === 'item') {
    // Book with Wikidata item: P248 stated in
    const parts: ReferencePart[] = [
      { property: { id: 'P248' }, value: { type: 'value', content: source.book.id } },
    ];
    if (source.page) {
      parts.push({ property: { id: 'P304' }, value: { type: 'value', content: source.page } });
    }
    return { parts };
  } else {
    // Book free-text: P1476 title + optional P2093 author + optional P577 year
    const parts: ReferencePart[] = [
      { property: { id: 'P1476' }, value: { type: 'value', content: { text: source.title, language: source.titleLanguage } } },
    ];
    if (source.author) {
      parts.push({ property: { id: 'P2093' }, value: { type: 'value', content: source.author } });
    }
    if (source.year) {
      const parsed = parseDate(source.year);
      if (parsed) {
        parts.push({ property: { id: 'P577' }, value: { type: 'value', content: { time: parsed.time, precision: parsed.precision, calendarmodel: parsed.calendarmodel } } });
      }
    }
    if (source.page) {
      parts.push({ property: { id: 'P304' }, value: { type: 'value', content: source.page } });
    }
    return { parts };
  }
}

/**
 * Builds the JSON Patch operations for an edit, given the item as it currently
 * stands in Wikidata.
 *
 * Kept free of I/O so the patch shapes stay testable. The REST API models
 * labels as plain strings and aliases as plain string arrays keyed by language
 * code, not as the `{ language, value }` objects the Action API takes.
 */
export function buildEditPatchOps(editData: BuildingEditData, item: any): any[] {
  const patchOps: any[] = [];
  const lang = getLocale();

  // Update label if provided
  if (editData.label !== undefined) {
    const previous = item.labels?.[lang];
    patchOps.push({
      op: previous !== undefined ? 'replace' : 'add',
      path: `/labels/${lang}`,
      value: editData.label,
    });

    // Items created here carry the same text as a `mul` label, which is what
    // speakers of every other language see. Keep it in step -- but only while
    // it still matches the label being replaced: a `mul` value someone else
    // has since customised is not ours to overwrite.
    if (item.labels?.mul !== undefined && item.labels.mul === previous) {
      patchOps.push({
        op: 'replace',
        path: '/labels/mul',
        value: editData.label,
      });
    }
  }

  // Update aliases if provided. The edit form is prefilled with the item's
  // current aliases, so what it sends is the whole list for this language --
  // names dropped from the field are meant to go.
  if (editData.aliases !== undefined) {
    const existing: string[] = item.aliases?.[lang] ?? [];
    const next = normalizeAliases(editData.aliases);
    const unchanged = next.length === existing.length && next.every((a, i) => a === existing[i]);

    if (!unchanged && next.length > 0) {
      patchOps.push({
        op: existing.length > 0 ? 'replace' : 'add',
        path: `/aliases/${lang}`,
        value: next,
      });
    } else if (!unchanged && existing.length > 0) {
      patchOps.push({
        op: 'remove',
        path: `/aliases/${lang}`,
      });
    }
  }

  // Update statements
  addCitableStatement(patchOps, item, 'P31', editData.citeType,
    (stmt) => stmt.value?.content === editData.type?.id,
    () => ({ property: { id: 'P31' }, value: createStatementValue(editData.type!, 'wikibase-item') }),
    editData.type !== undefined, editData.source);

  addCitableStatement(patchOps, item, 'P571', editData.citeInception,
    (stmt) => dateStatementMatches(stmt, editData.inception!),
    () => createDateStatement('P571', editData.inception!),
    editData.inception !== undefined, editData.source);

  addCitableStatement(patchOps, item, 'P576', editData.citeDemolished,
    (stmt) => dateStatementMatches(stmt, editData.demolished!),
    () => createDateStatement('P576', editData.demolished!),
    editData.demolished !== undefined, editData.source);

  if (editData.image) {
    const existing: any[] = item.statements?.P18 ?? [];
    if (!existing.some((stmt) => stmt.value?.content === editData.image)) {
      patchOps.push({
        op: existing.length > 0 ? 'replace' : 'add',
        path: '/statements/P18',
        value: [{ property: { id: 'P18' }, value: { type: 'value', content: editData.image } }],
      });
    }
  }

  if (editData.address) {
    addOrCompleteStatement(patchOps, item, 'P6375',
      { type: 'value', content: { text: editData.address, language: editData.addressLanguage } },
      (stmt) => stmt.value?.content?.text === editData.address
        && stmt.value?.content?.language === editData.addressLanguage,
      periodQualifiers(editData.addressStartDate, editData.addressEndDate),
      editData.source);
  }

  const people: Array<[string, WikidataItem | undefined, string?, string?]> = [
    ['P84', editData.architect],
    ['P88', editData.commissionedBy],
    ['P127', editData.owner, editData.ownerStartDate, editData.ownerEndDate],
    ['P466', editData.occupant, editData.occupantStartDate, editData.occupantEndDate],
  ];
  for (const [prop, person, start, end] of people) {
    if (!person) continue;
    addOrCompleteStatement(patchOps, item, prop,
      createStatementValue(person, 'wikibase-item'),
      (stmt) => stmt.value?.content === person.id,
      periodQualifiers(start, end),
      editData.source);
  }

  return patchOps;
}

type Qualifier = { property: { id: string }; value: any };

/** P580 start time / P582 end time qualifiers from form date strings. */
function periodQualifiers(start?: string, end?: string): Qualifier[] {
  const qualifiers: Qualifier[] = [];
  if (start) qualifiers.push({ property: { id: 'P580' }, value: createStatementValue(start, 'time') });
  if (end) qualifiers.push({ property: { id: 'P582' }, value: createStatementValue(end, 'time') });
  return qualifiers;
}

/**
 * Patch ops that append `additions` to a statement's qualifier or reference
 * list at `path`, creating the list when it is missing or empty.
 */
function appendToList(patchOps: any[], path: string, current: any[] | undefined, additions: any[]) {
  if (additions.length === 0) return;
  if (current && current.length > 0) {
    for (const value of additions) patchOps.push({ op: 'add', path: `${path}/-`, value });
  } else {
    patchOps.push({ op: 'add', path, value: additions });
  }
}

/**
 * Records a single-valued fact (type, inception, demolition). If any of the
 * property's statements already holds the value, the source is added to it as
 * a further reference and the other statements stay as they are. Only a value
 * the item doesn't have yet replaces the property's statements. With
 * `citeOnly` the value is known to exist already, so a missing match is an
 * error, never a replacement.
 */
function addCitableStatement(
  patchOps: any[],
  item: any,
  prop: string,
  citeOnly: boolean | undefined,
  matches: (stmt: any) => boolean,
  build: () => any,
  present: boolean,
  source: SourceRef | undefined,
) {
  if (!present) return;
  const existing: any[] = item.statements?.[prop] ?? [];
  const idx = existing.findIndex(matches);

  if (idx >= 0 && source) {
    appendToList(patchOps, `/statements/${prop}/${idx}/references`, existing[idx].references, [createReference(source)]);
    return;
  }
  if (citeOnly) {
    throw new Error(msg(str`Der vorhandene Wert von ${prop} wurde in Wikidata nicht gefunden. Bitte die Seite neu laden.`));
  }
  const statement = build();
  patchOps.push({
    op: existing.length > 0 ? 'replace' : 'add',
    path: `/statements/${prop}`,
    value: [source ? { ...statement, references: [createReference(source)] } : statement],
  });
}

/**
 * Orders two time contents (`{ time, precision }`) at the coarser of their
 * precisions: negative if `a` is earlier, positive if later, 0 if they can't
 * be told apart. Below month precision only the years are compared.
 */
function compareTimes(a: { time: string; precision: number }, b: { time: string; precision: number }): number {
  const parts = (time: string) => {
    const m = /^([+-])(\d+)-(\d\d)-(\d\d)/.exec(time);
    if (!m) return [0, 0, 0];
    return [(m[1] === '-' ? -1 : 1) * Number(m[2]), Number(m[3]), Number(m[4])];
  };
  const precision = Math.min(a.precision, b.precision);
  const depth = precision >= 11 ? 3 : precision === 10 ? 2 : 1;
  const pa = parts(a.time);
  const pb = parts(b.time);
  for (let i = 0; i < depth; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function sameTimeValue(a: any, b: any): boolean {
  return a?.type === 'value' && b?.type === 'value'
    && a.content?.time === b.content?.time
    && a.content?.precision === b.content?.precision;
}

/**
 * Records a value of a multi-valued property (address, people). A statement
 * with that value whose start/end qualifiers don't contradict the given ones
 * is completed: the missing qualifiers and the source are added to it.
 * Otherwise -- no such value, or one recorded for a different period -- a new
 * statement is appended.
 */
function addOrCompleteStatement(
  patchOps: any[],
  item: any,
  prop: string,
  value: any,
  matchesValue: (stmt: any) => boolean,
  qualifiers: Qualifier[],
  source: SourceRef | undefined,
) {
  const existing: any[] = item.statements?.[prop] ?? [];
  const qualifiersOf = (stmt: any, pid: string) =>
    (stmt.qualifiers ?? []).filter((q: any) => q.property?.id === pid);
  const knownTime = (stmt: any, pid: string) =>
    qualifiersOf(stmt, pid).find((q: any) => q.value?.type === 'value')?.value.content;
  const requested = (pid: string) => qualifiers.find((q) => q.property.id === pid)?.value.content;

  // The completed statement must still describe a period: its start, given
  // or existing, may not lie after its end.
  const periodStaysValid = (stmt: any) => {
    const start = requested('P580') ?? knownTime(stmt, 'P580');
    const end = requested('P582') ?? knownTime(stmt, 'P582');
    return !start || !end || compareTimes(start, end) <= 0;
  };

  const idx = existing.findIndex((stmt) => matchesValue(stmt) && qualifiers.every((q) => {
    const current = qualifiersOf(stmt, q.property.id);
    return current.length === 0 || current.some((c: any) => sameTimeValue(c.value, q.value));
  }) && periodStaysValid(stmt));

  if (idx < 0) {
    const statement = {
      property: { id: prop },
      value,
      ...(qualifiers.length > 0 && { qualifiers }),
      ...(source && { references: [createReference(source)] }),
    };
    patchOps.push({
      op: 'add',
      path: existing.length > 0 ? `/statements/${prop}/-` : `/statements/${prop}`,
      value: existing.length > 0 ? statement : [statement],
    });
    return;
  }

  const stmt = existing[idx];
  const missing = qualifiers.filter((q) => qualifiersOf(stmt, q.property.id).length === 0);
  appendToList(patchOps, `/statements/${prop}/${idx}/qualifiers`, stmt.qualifiers, missing);
  if (source) {
    appendToList(patchOps, `/statements/${prop}/${idx}/references`, stmt.references, [createReference(source)]);
  }
}


/**
 * Edits a Wikidata building entity using the REST API
 */
export async function editBuilding(
  editData: BuildingEditData,
  signal?: AbortSignal,
): Promise<void> {
  // Validate data first
  const validation = validateEditData(editData);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Not authenticated - please log in again');
  }

  console.log('Using REST API to edit building:', editData.id);

  // Fetch current item to get existing statements
  const getUrl = `${WIKIDATA_REST_API}/entities/items/${editData.id}`;
  console.log('Fetching item:', getUrl);

  const getResponse = await fetch(getUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!getResponse.ok) {
    throw new Error(`Failed to fetch item: ${getResponse.status}`);
  }

  const item = await getResponse.json();
  console.log('Current item:', item);

  const patchOps = buildEditPatchOps(editData, item);

  if (patchOps.length === 0) {
    console.log('No changes to make');
    return;
  }

  console.log('Patch operations:', patchOps);

  // Make the PATCH request
  const patchUrl = `${WIKIDATA_REST_API}/entities/items/${editData.id}`;
  const requestBody = { patch: patchOps, comment: 'Updated via Domus' };
  const patchResponse = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  const result = await patchResponse.json();
  console.log('PATCH response:', patchResponse.status, result);

  if (!patchResponse.ok) {
    console.error('PATCH failed:', {
      status: patchResponse.status,
      request: requestBody,
      response: result,
    });
    throw new Error(`Edit failed: ${result?.message || result?.error || patchResponse.status}`);
  }

  console.log('Edit successful:', result);

  // Track edit timestamp for staleness detection
  recordEdit(editData.id);
}

export interface BuildingCreateData {
  label: string;
  type?: WikidataItem;
  lat: number;
  lng: number;
  inception?: StatementDate;
  source: SourceRef;
}

/**
 * Creates a new Wikidata building item (Q41176 = building)
 */
export function buildBuildingItemPayload(data: BuildingCreateData) {
  const typeId = data.type?.id ?? 'Q41176';
  const reference = createReference(data.source);

  const statements: Record<string, any[]> = {
    P31: [{
      property: { id: 'P31' },
      value: { type: 'value', content: typeId },
      references: [reference],
    }],
    P625: [{
      property: { id: 'P625' },
      value: {
        type: 'value',
        content: {
          latitude: data.lat,
          longitude: data.lng,
          precision: 0.0001,
          globe: 'http://www.wikidata.org/entity/Q2',
        },
      },
      references: [reference],
    }],
  };

  if (data.inception) {
    statements['P571'] = [createDateStatement('P571', data.inception, data.source)];
  }

  const label = data.label.trim();
  return { labels: { [getLocale()]: label, mul: label }, statements };
}

export async function createBuilding(data: BuildingCreateData): Promise<WikidataItem> {
  if (!data.label.trim()) throw new Error('Building name is required');

  const token = await getValidAccessToken();
  if (!token) throw new Error('Not authenticated - please log in again');

  const item = buildBuildingItemPayload(data);

  const response = await fetch(`${WIKIDATA_REST_API}/entities/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ item, comment: 'Created building via Domus' }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to create building: ${result?.message || result?.error || response.status}`);
  }

  recordEdit(result.id);
  return { id: result.id, label: data.label.trim() };
}

export interface PersonItemPayload {
  labels: Record<string, string>;
  descriptions?: Record<string, string>;
  statements: {
    P31: Array<{ property: { id: string }; value: { type: string; content: string } }>;
  };
}

export function buildPersonItemPayload(name: string, description?: string): PersonItemPayload {
  const payload: PersonItemPayload = {
    labels: { [getLocale()]: name, mul: name },
    statements: {
      P31: [{ property: { id: 'P31' }, value: { type: 'value', content: 'Q5' } }],
    },
  };
  if (description) {
    payload.descriptions = { de: description };
  }
  return payload;
}

/**
 * Creates a new Wikidata person item (Q5 = human)
 */
export async function createPerson(
  name: string,
  description?: string,
): Promise<WikidataItem> {
  if (!name.trim()) {
    throw new Error('Person name is required');
  }

  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Not authenticated - please log in again');
  }

  const item = buildPersonItemPayload(name.trim(), description?.trim() || undefined);

  const response = await fetch(`${WIKIDATA_REST_API}/entities/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ item, comment: 'Created person via Domus' }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to create person: ${result?.message || result?.error || response.status}`);
  }

  return { id: result.id, label: name };
}
