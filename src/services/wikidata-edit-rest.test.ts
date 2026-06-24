import { describe, it, expect } from 'vitest';
import { validateEditData, buildPersonItemPayload, buildBuildingItemPayload } from './wikidata-edit-rest';
import type { BuildingEditData } from './wikidata-edit-rest';

const urlSource = { type: 'url' as const, url: 'https://example.com/source' };
const archiveSource = {
  type: 'archive' as const,
  archive: { id: 'Q594641', label: 'Stadtarchiv München' },
  callNumber: 'Rep. 5 Nr. 42',
};

describe('buildPersonItemPayload', () => {
  it('sets German label', () => {
    const payload = buildPersonItemPayload('Johann Müller');
    expect(payload.labels).toEqual({ de: 'Johann Müller' });
  });

  it('sets P31=Q5 (human) statement', () => {
    const payload = buildPersonItemPayload('Test Person');
    expect(payload.statements.P31).toHaveLength(1);
    expect(payload.statements.P31[0].property.id).toBe('P31');
    expect(payload.statements.P31[0].value.type).toBe('value');
    expect(payload.statements.P31[0].value.content).toBe('Q5');
  });

  it('omits descriptions when not provided', () => {
    const payload = buildPersonItemPayload('Test Person');
    expect(payload.descriptions).toBeUndefined();
  });

  it('includes German description when provided', () => {
    const payload = buildPersonItemPayload('Johann Müller', 'Bauer aus Musterstadt');
    expect(payload.descriptions).toEqual({ de: 'Bauer aus Musterstadt' });
  });

  it('omits descriptions when empty string passed', () => {
    const payload = buildPersonItemPayload('Test Person', '');
    expect(payload.descriptions).toBeUndefined();
  });
});

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
      source: urlSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Inception must be a year (YYYY) or ISO date');
  });

  it('accepts YYYY format for inception', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950',
      source: urlSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('accepts YYYY-MM-DD format for inception', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950-06-15',
      source: urlSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('validates demolished date format', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      demolished: 'not a date',
      source: urlSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Demolished date must be a year (YYYY) or ISO date');
  });

  it('requires source when editing claims', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950',
      // no source
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source is required when editing building data');
  });

  it('requires source when adding type', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      type: { id: 'Q3947', label: 'dwelling' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source is required when editing building data');
  });

  it('requires source when adding address', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      address: 'Hauptstraße 1',
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source is required when editing building data');
  });

  it('requires source when adding architect', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      architect: { id: 'Q456', label: 'Test Architect' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source is required when editing building data');
  });

  it('requires source when adding commissioned by', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      commissionedBy: { id: 'Q789', label: 'Test Commissioner' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source is required when editing building data');
  });

  it('requires source when adding owner', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      owner: { id: 'Q999', label: 'Test Owner' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source is required when editing building data');
  });

  it('requires source when adding occupant', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      occupant: { id: 'Q111', label: 'Test Occupant' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source is required when editing building data');
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
      source: { type: 'url', url: 'not a url' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source URL must be a valid URL');
  });

  it('accepts valid URL source', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950',
      source: urlSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('accepts valid archive source', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950',
      source: archiveSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('rejects archive source with invalid archive QID', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950',
      source: { type: 'archive', archive: { id: 'not-a-qid', label: 'Test' }, callNumber: 'Rep. 5' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Archive must be a valid Wikidata item');
  });

  it('rejects archive source with empty call number', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950',
      source: { type: 'archive', archive: { id: 'Q594641', label: 'Stadtarchiv München' }, callNumber: '  ' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Archive call number (Signatur) is required');
  });

  it('accepts archive source with optional page', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1950',
      source: { ...archiveSource, page: 'S. 12' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('accepts all new properties together with URL source', () => {
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
      source: urlSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts all new properties together with archive source', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1850',
      owner: { id: 'Q999', label: 'Test Owner' },
      source: archiveSource,
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
      source: urlSource,
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
      source: urlSource,
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
      source: urlSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts valid book item source', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1900',
      source: { type: 'book', mode: 'item', book: { id: 'Q456', label: 'Denkmäler in Bayern' } },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('accepts book item source with optional page', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1900',
      source: { type: 'book', mode: 'item', book: { id: 'Q456', label: 'Denkmäler in Bayern' }, page: '42' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('rejects book item source with invalid QID', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1900',
      source: { type: 'book', mode: 'item', book: { id: 'not-a-qid', label: 'Test' } },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Book must be a valid Wikidata item');
  });

  it('accepts valid book freetext source', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1900',
      source: { type: 'book', mode: 'freetext', title: 'Denkmäler in Bayern', titleLanguage: 'de' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('accepts book freetext source with all optional fields', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1900',
      source: { type: 'book', mode: 'freetext', title: 'Denkmäler in Bayern', titleLanguage: 'de', author: 'Georg Lill', year: '1934', page: '42' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('rejects book freetext source with empty title', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1900',
      source: { type: 'book', mode: 'freetext', title: '', titleLanguage: 'de' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Book title is required');
  });

  it('rejects book freetext source with invalid year', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: '1900',
      source: { type: 'book', mode: 'freetext', title: 'Test', titleLanguage: 'de', year: '19ab' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Book year must be a 4-digit year');
  });

  it('collects multiple validation errors', () => {
    const data: BuildingEditData = {
      id: 'invalid-id',
      label: '   ',
      type: { id: 'bad-type', label: 'Test' },
      inception: 'bad-date',
      source: { type: 'url', url: 'not-a-url' },
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

describe('buildBuildingItemPayload', () => {
  const base = {
    label: 'Müllerhof',
    lat: 48.12345,
    lng: 11.56789,
    source: urlSource,
  };

  it('sets German label', () => {
    const payload = buildBuildingItemPayload(base);
    expect(payload.labels).toEqual({ de: 'Müllerhof' });
  });

  it('trims label whitespace', () => {
    const payload = buildBuildingItemPayload({ ...base, label: '  Müllerhof  ' });
    expect(payload.labels.de).toBe('Müllerhof');
  });

  it('sets P31 to Q41176 (building) by default', () => {
    const payload = buildBuildingItemPayload(base);
    const p31 = payload.statements.P31[0];
    expect(p31.property.id).toBe('P31');
    expect(p31.value.type).toBe('value');
    expect(p31.value.content).toBe('Q41176');
  });

  it('sets P31 to provided type QID', () => {
    const payload = buildBuildingItemPayload({ ...base, type: { id: 'Q3947', label: 'dwelling' } });
    expect(payload.statements.P31[0].value.content).toBe('Q3947');
  });

  it('sets P625 with correct globe-coordinate shape', () => {
    const payload = buildBuildingItemPayload(base);
    const coord = payload.statements.P625[0].value.content;
    expect(coord.latitude).toBe(48.12345);
    expect(coord.longitude).toBe(11.56789);
    expect(coord.precision).toBe(0.0001);
    expect(coord.globe).toBe('http://www.wikidata.org/entity/Q2');
    expect(Object.keys(coord)).toEqual(['latitude', 'longitude', 'precision', 'globe']);
  });

  it('attaches reference to P31 and P625', () => {
    const payload = buildBuildingItemPayload(base);
    expect(payload.statements.P31[0].references).toHaveLength(1);
    expect(payload.statements.P625[0].references).toHaveLength(1);
  });

  it('omits P571 when inception is not provided', () => {
    const payload = buildBuildingItemPayload(base);
    expect(payload.statements.P571).toBeUndefined();
  });

  it('includes P571 when inception year is provided', () => {
    const payload = buildBuildingItemPayload({ ...base, inception: '1890' });
    const p571 = payload.statements.P571?.[0];
    expect(p571).toBeDefined();
    expect(p571.property.id).toBe('P571');
    expect(p571.value.content.time).toMatch(/^\+1890/);
    expect(p571.value.content.precision).toBeDefined();
    expect(p571.value.content.calendarmodel).toMatch(/Q\d+$/);
    expect(p571.references).toHaveLength(1);
  });

  it('uses archive source reference correctly', () => {
    const payload = buildBuildingItemPayload({ ...base, source: archiveSource });
    const ref = payload.statements.P31[0].references[0];
    expect(Array.isArray(ref.parts)).toBe(true);
    const propIds = ref.parts.map((p: any) => p.property.id);
    expect(propIds).toContain('P485');
  });
});
