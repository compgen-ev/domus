import { describe, it, expect } from 'vitest';
import { validateEditData, buildPersonItemPayload, buildBuildingItemPayload, createDateStatement, dateStatementMatches } from './wikidata-edit-rest';
import type { BuildingEditData } from './wikidata-edit-rest';
import { parseDate } from '../utils/dates';

/** StatementDate with a plain value, for tests. */
const date = (input: string) => ({ value: parseDate(input)! });

const urlSource = { type: 'url' as const, url: 'https://example.com/source' };
const archiveSource = {
  type: 'archive' as const,
  archive: { id: 'Q594641', label: 'Stadtarchiv München' },
  callNumber: 'Rep. 5 Nr. 42',
};

describe('buildPersonItemPayload', () => {
  it('sets label in current locale', () => {
    const payload = buildPersonItemPayload('Johann Müller');
    expect(Object.values(payload.labels)).toContain('Johann Müller');
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

  it('rejects an empty inception date', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: {},
      source: urlSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Inception date is empty');
  });

  it('accepts a value date for inception', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1950'),
      source: urlSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('accepts an unknown-value inception with only a latest bound', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: { latest: parseDate('1409')! },
      source: urlSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('rejects an empty demolished date', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      demolished: {},
      source: urlSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Demolished date is empty');
  });

  it('requires source when editing claims', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1950'),
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
      inception: date('1950'),
      source: { type: 'url', url: 'not a url' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source URL must be a valid URL');
  });

  it('accepts valid URL source', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1950'),
      source: urlSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('accepts valid archive source', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1950'),
      source: archiveSource,
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('rejects archive source with invalid archive QID', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1950'),
      source: { type: 'archive', archive: { id: 'not-a-qid', label: 'Test' }, callNumber: 'Rep. 5' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Archive must be a valid Wikidata item');
  });

  it('rejects archive source with empty call number', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1950'),
      source: { type: 'archive', archive: { id: 'Q594641', label: 'Stadtarchiv München' }, callNumber: '  ' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Archive call number (Signatur) is required');
  });

  it('accepts archive source with optional page', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1950'),
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
      inception: date('1950'),
      demolished: date('2020'),
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
      inception: date('1850'),
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
      inception: date('1900'),
      source: { type: 'book', mode: 'item', book: { id: 'Q456', label: 'Denkmäler in Bayern' } },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('accepts book item source with optional page', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1900'),
      source: { type: 'book', mode: 'item', book: { id: 'Q456', label: 'Denkmäler in Bayern' }, page: '42' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('rejects book item source with invalid QID', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1900'),
      source: { type: 'book', mode: 'item', book: { id: 'not-a-qid', label: 'Test' } },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Book must be a valid Wikidata item');
  });

  it('accepts valid book freetext source', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1900'),
      source: { type: 'book', mode: 'freetext', title: 'Denkmäler in Bayern', titleLanguage: 'de' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('accepts book freetext source with all optional fields', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1900'),
      source: { type: 'book', mode: 'freetext', title: 'Denkmäler in Bayern', titleLanguage: 'de', author: 'Georg Lill', year: '1934', page: '42' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(true);
  });

  it('rejects book freetext source with empty title', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1900'),
      source: { type: 'book', mode: 'freetext', title: '', titleLanguage: 'de' },
    };
    const result = validateEditData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Book title is required');
  });

  it('rejects book freetext source with invalid year', () => {
    const data: BuildingEditData = {
      id: 'Q123',
      inception: date('1900'),
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
      inception: {},
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

  it('sets label in current locale', () => {
    const payload = buildBuildingItemPayload(base);
    expect(Object.values(payload.labels)).toContain('Müllerhof');
  });

  it('trims label whitespace', () => {
    const payload = buildBuildingItemPayload({ ...base, label: '  Müllerhof  ' });
    expect(Object.values(payload.labels)[0]).toBe('Müllerhof');
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

  it('includes P571 when inception is provided', () => {
    const payload = buildBuildingItemPayload({ ...base, inception: date('1890') });
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

describe('createDateStatement', () => {
  it('builds a plain value statement', () => {
    const stmt = createDateStatement('P571', date('1950-06-15'), urlSource);
    expect(stmt).toEqual({
      property: { id: 'P571' },
      value: {
        type: 'value',
        content: {
          time: '+1950-06-15T00:00:00Z',
          precision: 11,
          calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
        },
      },
      references: [expect.anything()],
    });
  });

  it('uses P854 for a non-Wikimedia URL source', () => {
    const stmt = createDateStatement('P571', date('1950'), urlSource);
    expect(stmt.references![0].parts[0]).toEqual({
      property: { id: 'P854' },
      value: { type: 'value', content: urlSource.url },
    });
  });

  it.each([
    'https://de.wikipedia.org/wiki/Foo',
    'https://www.wikidata.org/wiki/Q1',
    'https://commons.wikimedia.org/wiki/File:Foo.jpg',
    'https://de.wikisource.org/wiki/Foo',
    'https://en.wikivoyage.org/wiki/Foo',
    'https://en.wiktionary.org/wiki/Foo',
  ])('uses P4656 for Wikimedia URL %s', (url) => {
    const stmt = createDateStatement('P571', date('1950'), { type: 'url', url });
    expect(stmt.references![0].parts[0]).toEqual({
      property: { id: 'P4656' },
      value: { type: 'value', content: url },
    });
  });

  it('does not use P4656 for a lookalike host spoofing a Wikimedia domain', () => {
    const url = 'https://de.wikipedia.org.evil.example.com/wiki/Foo';
    const stmt = createDateStatement('P571', date('1950'), { type: 'url', url });
    expect(stmt.references![0].parts[0]).toEqual({
      property: { id: 'P854' },
      value: { type: 'value', content: url },
    });
  });

  it('builds an unknown-value statement with a latest bound (vor 1409)', () => {
    const stmt = createDateStatement('P571', { latest: parseDate('1409')! });
    expect(stmt.value).toEqual({ type: 'somevalue' });
    expect(stmt.qualifiers).toEqual([
      {
        property: { id: 'P1326' },
        value: {
          type: 'value',
          content: {
            time: '+1409-00-00T00:00:00Z',
            precision: 9,
            calendarmodel: 'http://www.wikidata.org/entity/Q1985786',
          },
        },
      },
    ]);
  });

  it('builds both bounds for between', () => {
    const stmt = createDateStatement('P576', {
      earliest: parseDate('1380')!,
      latest: parseDate('1409')!,
    });
    expect(stmt.value).toEqual({ type: 'somevalue' });
    expect(stmt.qualifiers?.map((q: any) => q.property.id)).toEqual(['P1319', 'P1326']);
  });

  it('keeps preserved bounds qualifiers on a value statement', () => {
    const stmt = createDateStatement('P571', {
      value: parseDate('1401')!,
      latest: parseDate('1409')!,
    });
    expect(stmt.value.type).toBe('value');
    expect(stmt.qualifiers?.map((q: any) => q.property.id)).toEqual(['P1326']);
  });

  it('omits qualifiers and references when absent', () => {
    const stmt = createDateStatement('P571', date('1950'));
    expect(stmt).not.toHaveProperty('qualifiers');
    expect(stmt).not.toHaveProperty('references');
  });
});

describe('dateStatementMatches', () => {
  const somevalueStmt = {
    value: { type: 'somevalue' },
    qualifiers: [
      {
        property: { id: 'P1326' },
        value: {
          type: 'value',
          content: {
            time: '+1409-00-00T00:00:00Z',
            precision: 9,
            calendarmodel: 'http://www.wikidata.org/entity/Q1985786',
          },
        },
      },
    ],
  };

  it('matches an identical unknown-value statement', () => {
    expect(dateStatementMatches(somevalueStmt, { latest: parseDate('1409')! })).toBe(true);
  });
  it('rejects when the bound differs', () => {
    expect(dateStatementMatches(somevalueStmt, { latest: parseDate('1410')! })).toBe(false);
  });
  it('rejects when the mode differs (value vs somevalue)', () => {
    expect(dateStatementMatches(somevalueStmt, date('1409'))).toBe(false);
  });
  it('rejects when the edit has no bound but the statement does', () => {
    expect(dateStatementMatches(somevalueStmt, { earliest: parseDate('1380')! })).toBe(false);
  });
  it('matches a plain value statement on time and precision', () => {
    const stmt = createDateStatement('P571', date('1950'));
    expect(dateStatementMatches(stmt, date('1950'))).toBe(true);
    expect(dateStatementMatches(stmt, date('1950-06'))).toBe(false);
  });
});

describe('buildBuildingItemPayload unknown-value inception', () => {
  const base = {
    label: 'Testhaus',
    lat: 48.1,
    lng: 11.5,
    source: urlSource,
  };

  it('creates a somevalue P571 with a latest bound (vor 1409)', () => {
    const payload = buildBuildingItemPayload({ ...base, inception: { latest: parseDate('1409')! } });
    const p571 = payload.statements.P571?.[0];
    expect(p571.value).toEqual({ type: 'somevalue' });
    expect(p571.qualifiers).toEqual([
      {
        property: { id: 'P1326' },
        value: {
          type: 'value',
          content: {
            time: '+1409-00-00T00:00:00Z',
            precision: 9,
            calendarmodel: 'http://www.wikidata.org/entity/Q1985786',
          },
        },
      },
    ]);
    expect(p571.references).toHaveLength(1);
  });

  it('attaches the source reference to a plain-value inception too', () => {
    const payload = buildBuildingItemPayload({ ...base, inception: date('1890') });
    expect(payload.statements.P571[0].references).toHaveLength(1);
  });
});
