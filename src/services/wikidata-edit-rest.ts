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
import { parseDate } from '../utils/dates';
import { recordEdit } from './edit-tracker';

const WIKIDATA_REST_API = 'https://www.wikidata.org/w/rest.php/wikibase/v1';

/** Reference to an online source (P854 reference URL + optional P304 page). */
export interface UrlSource {
  type: 'url';
  url: string;
  page?: string;
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
  inception?: string;
  demolished?: string;
  address?: string;
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

  if (data.inception) {
    // Try to parse as user input (YYYY, YYYY-MM, YYYY-MM-DD)
    const parsed = parseDate(data.inception);
    if (!parsed) {
      errors.push('Inception must be a year (YYYY) or ISO date');
    }
  }

  if (data.demolished) {
    // Try to parse as user input (YYYY, YYYY-MM, YYYY-MM-DD)
    const parsed = parseDate(data.demolished);
    if (!parsed) {
      errors.push('Demolished date must be a year (YYYY) or ISO date');
    }
  }

  // Check if there are any non-empty changes to claims
  const hasClaimChanges = (data.type !== undefined) ||
                          (data.inception !== undefined && data.inception !== '') ||
                          (data.demolished !== undefined && data.demolished !== '') ||
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

/**
 * Builds a Wikidata REST API reference object from a SourceRef.
 */
type ReferencePart = { property: { id: string }; value: { type: string; content: unknown } };

function createReference(source: SourceRef) {
  if (source.type === 'url') {
    const parts: ReferencePart[] = [
      { property: { id: 'P854' }, value: { type: 'value', content: source.url } },
    ];
    if (source.page) {
      parts.push({ property: { id: 'P304' }, value: { type: 'value', content: source.page } });
    }
    return { parts };
  } else if (source.type === 'archive') {
    const parts: ReferencePart[] = [
      { property: { id: 'P485' }, value: { type: 'value', content: { id: source.archive.id } } },
      { property: { id: 'P217' }, value: { type: 'value', content: source.callNumber } },
    ];
    if (source.page) {
      parts.push({ property: { id: 'P304' }, value: { type: 'value', content: source.page } });
    }
    return { parts };
  } else if (source.mode === 'item') {
    // Book with Wikidata item: P248 stated in
    const parts: ReferencePart[] = [
      { property: { id: 'P248' }, value: { type: 'value', content: { id: source.book.id } } },
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

  // Build JSON Patch operations
  const patchOps: any[] = [];

  // Update label if provided
  if (editData.label !== undefined) {
    const hasGermanLabel = item.labels?.de !== undefined;
    patchOps.push({
      op: hasGermanLabel ? 'replace' : 'add',
      path: '/labels/de',
      value: { language: 'de', value: editData.label },
    });
  }

  // Update aliases if provided
  if (editData.aliases !== undefined) {
    const aliasArray = editData.aliases
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0)
      .map(a => ({ language: 'de', value: a }));

    if (aliasArray.length > 0) {
      const hasExistingAliases = item.aliases?.de && item.aliases.de.length > 0;
      patchOps.push({
        op: hasExistingAliases ? 'replace' : 'add',
        path: '/aliases/de',
        value: aliasArray,
      });
    }
  }

  // Update statements
  if (editData.type) {
    const existingStatements = item.statements?.P31 || [];
    const matchingIdx = existingStatements.findIndex((stmt: any) =>
      stmt.value?.content === editData.type!.id
    );

    if (matchingIdx >= 0 && editData.source) {
      // Add reference to existing statement
      const existingRefs = existingStatements[matchingIdx].references || [];
      const refPath = existingRefs.length > 0
        ? `/statements/P31/${matchingIdx}/references/-`
        : `/statements/P31/${matchingIdx}/references`;
      patchOps.push({
        op: 'add',
        path: refPath,
        value: existingRefs.length > 0 ? createReference(editData.source) : [createReference(editData.source)],
      });
    } else {
      // Add or replace P31 statements
      const newStatement = {
        property: { id: 'P31' },
        value: createStatementValue(editData.type, 'wikibase-item'),
        ...(editData.source && {
          references: [createReference(editData.source)],
        }),
      };

      patchOps.push({
        op: existingStatements.length > 0 ? 'replace' : 'add',
        path: '/statements/P31',
        value: [newStatement],
      });
    }
  }

  if (editData.inception) {
    const existingStatements = item.statements?.P571 || [];
    const normalizedInception = editData.inception.startsWith('+') ? editData.inception : `+${editData.inception}`;
    const matchingIdx = existingStatements.findIndex((stmt: any) =>
      stmt.value?.content?.time === normalizedInception
    );

    if (matchingIdx >= 0 && editData.source) {
      const existingRefs = existingStatements[matchingIdx].references || [];
      const refPath = existingRefs.length > 0
        ? `/statements/P571/${matchingIdx}/references/-`
        : `/statements/P571/${matchingIdx}/references`;
      patchOps.push({
        op: 'add',
        path: refPath,
        value: existingRefs.length > 0 ? createReference(editData.source) : [createReference(editData.source)],
      });
    } else {
      const newStatement = {
        property: { id: 'P571' },
        value: createStatementValue(editData.inception, 'time'),
        ...(editData.source && {
          references: [createReference(editData.source)],
        }),
      };

      patchOps.push({
        op: existingStatements.length > 0 ? 'replace' : 'add',
        path: '/statements/P571',
        value: [newStatement],
      });
    }
  }

  if (editData.demolished) {
    const existingStatements = item.statements?.P576 || [];
    const normalizedDemolished = editData.demolished.startsWith('+') ? editData.demolished : `+${editData.demolished}`;
    const matchingIdx = existingStatements.findIndex((stmt: any) =>
      stmt.value?.content?.time === normalizedDemolished
    );

    if (matchingIdx >= 0 && editData.source) {
      const existingRefs = existingStatements[matchingIdx].references || [];
      const refPath = existingRefs.length > 0
        ? `/statements/P576/${matchingIdx}/references/-`
        : `/statements/P576/${matchingIdx}/references`;
      patchOps.push({
        op: 'add',
        path: refPath,
        value: existingRefs.length > 0 ? createReference(editData.source) : [createReference(editData.source)],
      });
    } else {
      const newStatement = {
        property: { id: 'P576' },
        value: createStatementValue(editData.demolished, 'time'),
        ...(editData.source && {
          references: [createReference(editData.source)],
        }),
      };

      patchOps.push({
        op: existingStatements.length > 0 ? 'replace' : 'add',
        path: '/statements/P576',
        value: [newStatement],
      });
    }
  }

  // Handle address (P6375 - monolingual text)
  if (editData.address) {
    const existingStatements = item.statements?.P6375 || [];
    // Check for duplicate (compare text content)
    const isDuplicate = existingStatements.some((stmt: any) =>
      stmt.value?.content?.text === editData.address
    );

    if (!isDuplicate) {
      const qualifiers: any[] = [];

      // Add start time qualifier (P580) if provided
      if (editData.addressStartDate) {
        qualifiers.push({
          property: { id: 'P580' },
          value: createStatementValue(editData.addressStartDate, 'time'),
        });
      }

      // Add end time qualifier (P582) if provided
      if (editData.addressEndDate) {
        qualifiers.push({
          property: { id: 'P582' },
          value: createStatementValue(editData.addressEndDate, 'time'),
        });
      }

      const newStatement = {
        property: { id: 'P6375' },
        value: {
          type: 'value',
          content: {
            text: editData.address,
            language: 'de',  // German language code
          },
        },
        ...(qualifiers.length > 0 && { qualifiers }),
        ...(editData.source && {
          references: [createReference(editData.source)],
        }),
      };

      patchOps.push({
        op: existingStatements.length > 0 ? 'add' : 'add',
        path: existingStatements.length > 0 ? '/statements/P6375/-' : '/statements/P6375',
        value: existingStatements.length > 0 ? newStatement : [newStatement],
      });
    }
  }

  // Handle architect (P84 - wikibase-item)
  if (editData.architect) {
    const existingStatements = item.statements?.P84 || [];
    // Check for duplicate
    const isDuplicate = existingStatements.some((stmt: any) =>
      stmt.value?.content === editData.architect!.id
    );

    if (!isDuplicate) {
      const newStatement = {
        property: { id: 'P84' },
        value: createStatementValue(editData.architect, 'wikibase-item'),
        ...(editData.source && {
          references: [createReference(editData.source)],
        }),
      };

      patchOps.push({
        op: 'add',
        path: existingStatements.length > 0 ? '/statements/P84/-' : '/statements/P84',
        value: existingStatements.length > 0 ? newStatement : [newStatement],
      });
    }
  }

  // Handle commissioned by (P88 - wikibase-item)
  if (editData.commissionedBy) {
    const existingStatements = item.statements?.P88 || [];
    const isDuplicate = existingStatements.some((stmt: any) =>
      stmt.value?.content === editData.commissionedBy!.id
    );

    if (!isDuplicate) {
      const newStatement = {
        property: { id: 'P88' },
        value: createStatementValue(editData.commissionedBy, 'wikibase-item'),
        ...(editData.source && {
          references: [createReference(editData.source)],
        }),
      };

      patchOps.push({
        op: 'add',
        path: existingStatements.length > 0 ? '/statements/P88/-' : '/statements/P88',
        value: existingStatements.length > 0 ? newStatement : [newStatement],
      });
    }
  }

  // Handle owner (P127 - wikibase-item)
  if (editData.owner) {
    const existingStatements = item.statements?.P127 || [];
    const isDuplicate = existingStatements.some((stmt: any) =>
      stmt.value?.content === editData.owner!.id
    );

    if (!isDuplicate) {
      const qualifiers: any[] = [];

      if (editData.ownerStartDate) {
        qualifiers.push({
          property: { id: 'P580' },
          value: createStatementValue(editData.ownerStartDate, 'time'),
        });
      }

      if (editData.ownerEndDate) {
        qualifiers.push({
          property: { id: 'P582' },
          value: createStatementValue(editData.ownerEndDate, 'time'),
        });
      }

      const newStatement = {
        property: { id: 'P127' },
        value: createStatementValue(editData.owner, 'wikibase-item'),
        ...(qualifiers.length > 0 && { qualifiers }),
        ...(editData.source && {
          references: [createReference(editData.source)],
        }),
      };

      patchOps.push({
        op: 'add',
        path: existingStatements.length > 0 ? '/statements/P127/-' : '/statements/P127',
        value: existingStatements.length > 0 ? newStatement : [newStatement],
      });
    }
  }

  // Handle occupant (P466 - wikibase-item)
  if (editData.occupant) {
    const existingStatements = item.statements?.P466 || [];
    const isDuplicate = existingStatements.some((stmt: any) =>
      stmt.value?.content === editData.occupant!.id
    );

    if (!isDuplicate) {
      const qualifiers: any[] = [];

      if (editData.occupantStartDate) {
        qualifiers.push({
          property: { id: 'P580' },
          value: createStatementValue(editData.occupantStartDate, 'time'),
        });
      }

      if (editData.occupantEndDate) {
        qualifiers.push({
          property: { id: 'P582' },
          value: createStatementValue(editData.occupantEndDate, 'time'),
        });
      }

      const newStatement = {
        property: { id: 'P466' },
        value: createStatementValue(editData.occupant, 'wikibase-item'),
        ...(qualifiers.length > 0 && { qualifiers }),
        ...(editData.source && {
          references: [createReference(editData.source)],
        }),
      };

      patchOps.push({
        op: 'add',
        path: existingStatements.length > 0 ? '/statements/P466/-' : '/statements/P466',
        value: existingStatements.length > 0 ? newStatement : [newStatement],
      });
    }
  }

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
  inception?: string;
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
    const parsed = parseDate(data.inception);
    if (parsed) {
      statements['P571'] = [{
        property: { id: 'P571' },
        value: {
          type: 'value',
          content: { time: parsed.time, precision: parsed.precision, calendarmodel: parsed.calendarmodel },
        },
        references: [reference],
      }];
    }
  }

  return { labels: { de: data.label.trim() }, statements };
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
    labels: { de: name },
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
