import type { WikidataItem } from '../types/building';
import { getAccessToken } from './wikimedia-auth';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

interface CSRFTokenResponse {
  query?: {
    tokens?: {
      csrftoken?: string;
    };
  };
  error?: {
    code: string;
    info: string;
  };
}

interface EditEntityResponse {
  success?: number;
  entity?: {
    id: string;
    lastrevid: number;
  };
  error?: {
    code: string;
    info: string;
    messages?: Array<{ name: string; parameters: string[] }>;
  };
}

/**
 * Gets a CSRF token required for editing
 */
async function getCSRFToken(signal?: AbortSignal): Promise<string> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = new URL(WIKIDATA_API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('meta', 'tokens');
  url.searchParams.set('type', 'csrf');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to get CSRF token: ${response.status}`);
  }

  const data: CSRFTokenResponse = await response.json();

  if (data.error) {
    throw new Error(`CSRF token error: ${data.error.code} - ${data.error.info}`);
  }

  const csrfToken = data.query?.tokens?.csrftoken;
  if (!csrfToken || csrfToken === '+\\') {
    throw new Error('Invalid CSRF token received');
  }

  return csrfToken;
}

/**
 * Creates a Wikidata statement for a property
 */
function createStatement(propertyId: string, value: string | WikidataItem, type: 'string' | 'time' | 'wikibase-item') {
  let datavalue;

  if (type === 'string') {
    datavalue = {
      value: value as string,
      type: 'string',
    };
  } else if (type === 'time') {
    // ISO 8601 format for dates
    const timeValue = value as string;
    datavalue = {
      value: {
        time: timeValue.startsWith('+') ? timeValue : `+${timeValue}`,
        timezone: 0,
        before: 0,
        after: 0,
        precision: 9, // Year precision (can be adjusted)
        calendarmodel: 'http://www.wikidata.org/entity/Q1985727', // Proleptic Gregorian
      },
      type: 'time',
    };
  } else if (type === 'wikibase-item') {
    const item = value as WikidataItem;
    datavalue = {
      value: {
        'entity-type': 'item',
        'numeric-id': parseInt(item.id.substring(1)), // Remove 'Q' prefix
        id: item.id,
      },
      type: 'wikibase-entityid',
    };
  }

  return {
    mainsnak: {
      snaktype: 'value',
      property: propertyId,
      datavalue,
    },
    type: 'statement',
    rank: 'normal',
  };
}

export interface BuildingEditData {
  id: string;
  label?: string;
  type?: WikidataItem;
  inception?: string;
  demolished?: string;
  // Add more as needed
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
    // Check if it's a valid year or ISO date
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

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Edits a Wikidata building entity
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

  // Get CSRF token
  const csrfToken = await getCSRFToken(signal);

  // Build the data object
  const data: {
    labels?: Record<string, { language: string; value: string }>;
    claims?: Record<string, any[]>;
  } = {};

  // Update label if provided
  if (editData.label !== undefined) {
    data.labels = {
      de: {
        language: 'de',
        value: editData.label,
      },
    };
  }

  // Update claims
  data.claims = {};

  if (editData.type) {
    // P31 = instance of
    data.claims.P31 = [createStatement('P31', editData.type, 'wikibase-item')];
  }

  if (editData.inception) {
    // P571 = inception
    data.claims.P571 = [createStatement('P571', editData.inception, 'time')];
  }

  if (editData.demolished) {
    // P576 = dissolved, abolished or demolished
    data.claims.P576 = [createStatement('P576', editData.demolished, 'time')];
  }

  // Make the edit request
  const formData = new FormData();
  formData.append('action', 'wbeditentity');
  formData.append('id', editData.id);
  formData.append('data', JSON.stringify(data));
  formData.append('token', csrfToken);
  formData.append('format', 'json');
  formData.append('formatversion', '2');
  formData.append('summary', 'Updated via Domus');

  const response = await fetch(WIKIDATA_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Edit request failed: ${response.status}`);
  }

  const result: EditEntityResponse = await response.json();

  if (result.error) {
    const errorMsg = result.error.messages
      ? result.error.messages.map(m => m.name).join(', ')
      : result.error.info;
    throw new Error(`Wikidata edit error: ${result.error.code} - ${errorMsg}`);
  }

  if (!result.success) {
    throw new Error('Edit failed: No success response');
  }
}
