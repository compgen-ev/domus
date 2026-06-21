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
import { getAccessToken } from './wikimedia-auth';
import { parseDate } from '../utils/dates';

const WIKIDATA_REST_API = 'https://www.wikidata.org/w/rest.php/wikibase/v1';

export interface BuildingEditData {
  id: string;
  label?: string;
  type?: WikidataItem;
  inception?: string;
  demolished?: string;
  sourceUrl?: string;
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
    const yearMatch = data.inception.match(/^[+-]?\d{1,4}$/);
    const isoMatch = data.inception.match(/^[+-]?\d{1,4}-\d{2}-\d{2}T/);
    if (!yearMatch && !isoMatch) {
      errors.push('Inception must be a year (YYYY) or ISO date');
    }
  }

  if (data.demolished) {
    const yearMatch = data.demolished.match(/^[+-]?\d{1,4}$/);
    const isoMatch = data.demolished.match(/^[+-]?\d{1,4}-\d{2}-\d{2}T/);
    if (!yearMatch && !isoMatch) {
      errors.push('Demolished date must be a year (YYYY) or ISO date');
    }
  }

  // Check if there are any non-empty changes to claims
  const hasClaimChanges = (data.type !== undefined) ||
                          (data.inception !== undefined && data.inception !== '') ||
                          (data.demolished !== undefined && data.demolished !== '');

  if (hasClaimChanges && !data.sourceUrl) {
    errors.push('Source URL is required when editing building data');
  }

  if (data.sourceUrl) {
    try {
      new URL(data.sourceUrl);
    } catch {
      errors.push('Source URL must be a valid URL');
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
 * Creates a reference for a statement
 */
function createReference(referenceUrl: string) {
  return {
    parts: [
      {
        property: { id: 'P854' }, // P854 = reference URL
        value: { type: 'value', content: referenceUrl },
      },
    ],
  };
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

  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
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
    patchOps.push({
      op: 'replace',
      path: '/labels/de',
      value: { language: 'de', value: editData.label },
    });
  }

  // Update statements
  if (editData.type) {
    const existingStatements = item.statements?.P31 || [];
    const matchingIdx = existingStatements.findIndex((stmt: any) =>
      stmt.value?.content === editData.type!.id
    );

    if (matchingIdx >= 0 && editData.sourceUrl) {
      // Add reference to existing statement
      const refPath = `/statements/P31/${matchingIdx}/references/-`;
      patchOps.push({
        op: 'add',
        path: refPath,
        value: createReference(editData.sourceUrl),
      });
    } else {
      // Add or replace P31 statements
      const newStatement = {
        property: { id: 'P31' },
        value: createStatementValue(editData.type, 'wikibase-item'),
        ...(editData.sourceUrl && {
          references: [createReference(editData.sourceUrl)],
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

    if (matchingIdx >= 0 && editData.sourceUrl) {
      const refPath = `/statements/P571/${matchingIdx}/references/-`;
      patchOps.push({
        op: 'add',
        path: refPath,
        value: createReference(editData.sourceUrl),
      });
    } else {
      const newStatement = {
        property: { id: 'P571' },
        value: createStatementValue(editData.inception, 'time'),
        ...(editData.sourceUrl && {
          references: [createReference(editData.sourceUrl)],
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

    if (matchingIdx >= 0 && editData.sourceUrl) {
      const refPath = `/statements/P576/${matchingIdx}/references/-`;
      patchOps.push({
        op: 'add',
        path: refPath,
        value: createReference(editData.sourceUrl),
      });
    } else {
      const newStatement = {
        property: { id: 'P576' },
        value: createStatementValue(editData.demolished, 'time'),
        ...(editData.sourceUrl && {
          references: [createReference(editData.sourceUrl)],
        }),
      };

      patchOps.push({
        op: existingStatements.length > 0 ? 'replace' : 'add',
        path: '/statements/P576',
        value: [newStatement],
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
  const patchResponse = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ patch: patchOps, comment: 'Updated via Domus' }),
    signal,
  });

  const result = await patchResponse.json();
  console.log('PATCH response:', patchResponse.status, result);

  if (!patchResponse.ok) {
    console.error('PATCH failed:', {
      status: patchResponse.status,
      result,
      sentPatch: patchOps,
    });
    throw new Error(`Edit failed: ${result?.message || result?.error || patchResponse.status}`);
  }

  console.log('Edit successful:', result);
}
