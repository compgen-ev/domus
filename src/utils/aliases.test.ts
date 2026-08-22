import { describe, it, expect } from 'vitest';
import { normalizeAliases } from './aliases';

describe('normalizeAliases', () => {
  it('splits on commas and trims each name', () => {
    expect(normalizeAliases('Müllerhof, Alte Schmiede')).toEqual(['Müllerhof', 'Alte Schmiede']);
  });

  it('keeps names that contain spaces intact', () => {
    expect(normalizeAliases('Geburtshaus von Galileo Galilei')).toEqual([
      'Geburtshaus von Galileo Galilei',
    ]);
  });

  it('drops empty entries and stray separators', () => {
    expect(normalizeAliases(' , Müllerhof ,, ')).toEqual(['Müllerhof']);
  });

  it('drops repeated names', () => {
    expect(normalizeAliases('Müllerhof, Müllerhof')).toEqual(['Müllerhof']);
  });

  it('returns an empty list for an empty field', () => {
    expect(normalizeAliases('')).toEqual([]);
    expect(normalizeAliases('   ')).toEqual([]);
  });
});
