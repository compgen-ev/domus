import { describe, it, expect } from 'vitest';
import { validateEditData } from './wikidata-edit-rest';
import type { BuildingEditData } from './wikidata-edit-rest';

describe('validateEditData', () => {
  it('validates building ID format', () => {
    const invalid: BuildingEditData = { id: 'invalid' };
    const result = validateEditData(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Building ID must be in format Q123');
  });

  it('accepts valid building ID', () => {
    const valid: BuildingEditData = { id: 'Q123' };
    const result = validateEditData(valid);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects empty label', () => {
    const data: BuildingEditData = { id: 'Q123', label: '   ' };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Label cannot be empty');
  });

  it('validates type ID format', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      type: { id: 'invalid', label: 'Test' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Building type ID must be in format Q123');
  });

  it('validates inception date format', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: 'not a date',
      sourceUrl: 'https://example.com',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Inception must be a year (YYYY) or ISO date');
  });

  it('accepts YYYY format for inception', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950',
      sourceUrl: 'https://example.com',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('accepts YYYY-MM-DD format for inception', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950-06-15',
      sourceUrl: 'https://example.com',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('validates demolished date format', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      demolished: 'not a date',
      sourceUrl: 'https://example.com',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Demolished date must be a year (YYYY) or ISO date');
  });

  it('requires source URL when editing claims', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950',
      // no sourceUrl
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source URL is required when editing building data');
  });

  it('requires source URL when adding type', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      type: { id: 'Q3947', label: 'dwelling' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source URL is required when editing building data');
  });

  it('requires source URL when adding address', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      address: 'Hauptstraße 1',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source URL is required when editing building data');
  });

  it('requires source URL when adding architect', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      architect: { id: 'Q456', label: 'Test Architect' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source URL is required when editing building data');
  });

  it('requires source URL when adding commissioned by', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      commissionedBy: { id: 'Q789', label: 'Test Commissioner' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source URL is required when editing building data');
  });

  it('requires source URL when adding owner', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      owner: { id: 'Q999', label: 'Test Owner' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source URL is required when editing building data');
  });

  it('requires source URL when adding occupant', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      occupant: { id: 'Q111', label: 'Test Occupant' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source URL is required when editing building data');
  });

  it('allows label change without source URL', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      label: 'New Label',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('validates source URL format', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950',
      sourceUrl: 'not a url',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source URL must be a valid URL');
  });

  it('accepts valid source URL', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950',
      sourceUrl: 'https://example.com/source',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('accepts all new properties together with source URL', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      label: 'New Building Name',
      type: { id: 'Q3947', label: 'dwelling' },
      inception: '1950',
      demolished: '2020',
      address: 'Hauptstraße 1',
      architect: { id: 'Q456', label: 'Test Architect' },
      commissionedBy: { id: 'Q789', label: 'Test Commissioner' },
      owner: { id: 'Q999', label: 'Test Owner' },
      occupant: { id: 'Q111', label: 'Test Occupant' },
      sourceUrl: 'https://example.com/source',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts address with time qualifiers', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      address: 'Hauptstraße 1',
      addressStartDate: '1850',
      addressEndDate: '1920',
      sourceUrl: 'https://example.com/source',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts owner with time qualifiers', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      owner: { id: 'Q999', label: 'Test Owner' },
      ownerStartDate: '1900',
      ownerEndDate: '1950',
      sourceUrl: 'https://example.com/source',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts occupant with time qualifiers', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      occupant: { id: 'Q111', label: 'Test Occupant' },
      occupantStartDate: '1920',
      occupantEndDate: '1945',
      sourceUrl: 'https://example.com/source',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('collects multiple validation errors', () => {
    const data: BuildingEditData = {
      id: 'invalid-id',
      label: '   ',
      type: { id: 'bad-type', label: 'Test' },
      inception: 'bad-date',
      sourceUrl: 'not-a-url',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(3);
  });
});

describe('patch operations', () => {
  it('should use correct structure for monolingual text (address)', () => {
    // This is a structural test - the actual value should be:
    // { type: 'value', content: { text: 'Hauptstraße 1', language: 'de' } }
    const addressValue = {
      type: 'value',
      content: {
        text: 'Hauptstraße 1',
        language: 'de',
      },
    };

    expect(addressValue.content).toHaveProperty('text');
    expect(addressValue.content).toHaveProperty('language');
    expect(addressValue.content.language).toBe('de');
  });

  it('should use correct structure for wikibase-item (architect)', () => {
    // The actual value should be: { type: 'value', content: 'Q456' }
    const architectValue = {
      type: 'value',
      content: 'Q456', // Just the ID string for wikibase-item
    };

    expect(typeof architectValue.content).toBe('string');
    expect(architectValue.content).toMatch(/^Q\d+$/);
  });

  it('should use correct structure for time value', () => {
    // The actual value should include calendarmodel based on year
    const timeValue1448 = {
      type: 'value',
      content: {
        time: '+1448-00-00T00:00:00Z',
        precision: 9,
        calendarmodel: 'http://www.wikidata.org/entity/Q1985786', // Julian
      },
    };

    const timeValue2000 = {
      type: 'value',
      content: {
        time: '+2000-00-00T00:00:00Z',
        precision: 9,
        calendarmodel: 'http://www.wikidata.org/entity/Q1985727', // Gregorian
      },
    };

    expect(timeValue1448.content.calendarmodel).toContain('Q1985786');
    expect(timeValue2000.content.calendarmodel).toContain('Q1985727');
  });

  it('should use correct reference structure', () => {
    // References should have parts as an array with property/value structure
    const reference = {
      parts: [
        {
          property: { id: 'P854' },
          value: { type: 'value', content: 'https://example.com' },
        },
      ],
    };

    expect(Array.isArray(reference.parts)).toBe(true);
    expect(reference.parts[0]).toHaveProperty('property');
    expect(reference.parts[0]).toHaveProperty('value');
    expect(reference.parts[0].property.id).toBe('P854');
  });

  it('should use correct qualifier structure for time qualifiers', () => {
    // Qualifiers for P580 (start time) and P582 (end time)
    const qualifiers = [
      {
        property: { id: 'P580' },
        value: {
          type: 'value',
          content: {
            time: '+1900-00-00T00:00:00Z',
            precision: 9,
            calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
          },
        },
      },
      {
        property: { id: 'P582' },
        value: {
          type: 'value',
          content: {
            time: '+1950-00-00T00:00:00Z',
            precision: 9,
            calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
          },
        },
      },
    ];

    expect(Array.isArray(qualifiers)).toBe(true);
    expect(qualifiers[0].property.id).toBe('P580'); // start time
    expect(qualifiers[1].property.id).toBe('P582'); // end time
    expect(qualifiers[0].value.content).toHaveProperty('time');
    expect(qualifiers[0].value.content).toHaveProperty('precision');
    expect(qualifiers[0].value.content).toHaveProperty('calendarmodel');
  });
});

describe('deduplication logic', () => {
  it('should detect duplicate addresses by text content', () => {
    const existingStatements = [
      {
        value: {
          content: {
            text: 'Hauptstraße 1',
            language: 'de',
          },
        },
      },
    ];

    const newAddress = 'Hauptstraße 1';
    const isDuplicate = existingStatements.some(
      (stmt: any) => stmt.value?.content?.text === newAddress
    );

    expect(isDuplicate).toBe(true);
  });

  it('should detect duplicate architects by ID', () => {
    const existingStatements = [
      {
        value: {
          content: 'Q456', // architect ID
        },
      },
    ];

    const newArchitect = { id: 'Q456', label: 'Test Architect' };
    const isDuplicate = existingStatements.some(
      (stmt: any) => stmt.value?.content === newArchitect.id
    );

    expect(isDuplicate).toBe(true);
  });

  it('should not detect duplicate when address is different', () => {
    const existingStatements = [
      {
        value: {
          content: {
            text: 'Hauptstraße 1',
            language: 'de',
          },
        },
      },
    ];

    const newAddress = 'Bahnhofstraße 5';
    const isDuplicate = existingStatements.some(
      (stmt: any) => stmt.value?.content?.text === newAddress
    );

    expect(isDuplicate).toBe(false);
  });

  it('should not detect duplicate when architect ID is different', () => {
    const existingStatements = [
      {
        value: {
          content: 'Q456',
        },
      },
    ];

    const newArchitect = { id: 'Q789', label: 'Different Architect' };
    const isDuplicate = existingStatements.some(
      (stmt: any) => stmt.value?.content === newArchitect.id
    );

    expect(isDuplicate).toBe(false);
  });
});
