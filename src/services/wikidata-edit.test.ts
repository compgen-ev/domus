import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateEditData, editBuilding, type BuildingEditData } from './wikidata-edit';
import * as wikimediaAuth from './wikimedia-auth';

// Mock the auth module
vi.mock('./wikimedia-auth', () => ({
  getAccessToken: vi.fn(),
}));

describe('validateEditData', () => {
  describe('valid data', () => {
    it('accepts valid minimal data', () => {
      const data: BuildingEditData = {
        id: 'Q123',
      };
      const result = validateEditData(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts valid complete data', () => {
      const data: BuildingEditData = {
        id: 'Q123',
        label: 'Test Building',
        type: { id: 'Q3947', label: 'dwelling' },
        inception: '1950',
        demolished: '2000',
      };
      const result = validateEditData(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts ISO date format for inception', () => {
      const data: BuildingEditData = {
        id: 'Q123',
        inception: '+1950-06-15T00:00:00Z',
      };
      const result = validateEditData(data);
      expect(result.valid).toBe(true);
    });

    it('accepts negative year (BCE)', () => {
      const data: BuildingEditData = {
        id: 'Q123',
        inception: '-500',
      };
      const result = validateEditData(data);
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid building ID', () => {
    it('rejects missing ID', () => {
      const data = {} as BuildingEditData;
      const result = validateEditData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Building ID is required');
    });

    it('rejects malformed ID without Q prefix', () => {
      const data: BuildingEditData = { id: '123' };
      const result = validateEditData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Building ID must be in format Q123');
    });

    it('rejects ID with letters after Q', () => {
      const data: BuildingEditData = { id: 'QABC' };
      const result = validateEditData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Building ID must be in format Q123');
    });

    it('rejects empty ID', () => {
      const data: BuildingEditData = { id: '' };
      const result = validateEditData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Building ID is required');
    });
  });

  describe('invalid label', () => {
    it('rejects empty label string', () => {
      const data: BuildingEditData = {
        id: 'Q123',
        label: '   ',
      };
      const result = validateEditData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Label cannot be empty');
    });
  });

  describe('invalid building type', () => {
    it('rejects malformed type ID', () => {
      const data: BuildingEditData = {
        id: 'Q123',
        type: { id: '3947', label: 'dwelling' },
      };
      const result = validateEditData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Building type ID must be in format Q123');
    });

    it('rejects type with non-numeric ID', () => {
      const data: BuildingEditData = {
        id: 'Q123',
        type: { id: 'QXYZ', label: 'dwelling' },
      };
      const result = validateEditData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Building type ID must be in format Q123');
    });
  });

  describe('invalid dates', () => {
    it('rejects inception with invalid format', () => {
      const data: BuildingEditData = {
        id: 'Q123',
        inception: 'sometime in 1950',
      };
      const result = validateEditData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Inception must be a year (YYYY) or ISO date');
    });

    it('rejects demolished with invalid format', () => {
      const data: BuildingEditData = {
        id: 'Q123',
        demolished: '2000s',
      };
      const result = validateEditData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Demolished date must be a year (YYYY) or ISO date');
    });

    it('rejects year with too many digits', () => {
      const data: BuildingEditData = {
        id: 'Q123',
        inception: '19500',
      };
      const result = validateEditData(data);
      expect(result.valid).toBe(false);
    });
  });

  describe('multiple errors', () => {
    it('collects all validation errors', () => {
      const data: BuildingEditData = {
        id: 'INVALID',
        label: '',
        type: { id: 'BAD', label: 'test' },
        inception: 'invalid',
      };
      const result = validateEditData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});

describe('editBuilding', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    vi.mocked(wikimediaAuth.getAccessToken).mockReturnValue('mock-token');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('throws when not authenticated', async () => {
      vi.mocked(wikimediaAuth.getAccessToken).mockReturnValue(null);

      const data: BuildingEditData = { id: 'Q123' };

      await expect(editBuilding(data)).rejects.toThrow('Not authenticated');
    });
  });

  describe('validation', () => {
    it('throws when validation fails', async () => {
      const data: BuildingEditData = { id: 'INVALID' };

      await expect(editBuilding(data)).rejects.toThrow('Validation failed');
    });

    it('includes validation errors in message', async () => {
      const data: BuildingEditData = { id: '' };

      await expect(editBuilding(data)).rejects.toThrow('Building ID is required');
    });
  });

  describe('CSRF token', () => {
    it('throws when CSRF token request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const data: BuildingEditData = { id: 'Q123' };

      await expect(editBuilding(data)).rejects.toThrow('Failed to get CSRF token: 500');
    });

    it('throws when CSRF token response has error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: {
            code: 'badtoken',
            info: 'Invalid token',
          },
        }),
      });

      const data: BuildingEditData = { id: 'Q123' };

      await expect(editBuilding(data)).rejects.toThrow('CSRF token error: badtoken - Invalid token');
    });

    it('throws when CSRF token is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            tokens: {
              csrftoken: '+\\',
            },
          },
        }),
      });

      const data: BuildingEditData = { id: 'Q123' };

      await expect(editBuilding(data)).rejects.toThrow('Invalid CSRF token received');
    });

    it('throws when CSRF token is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            tokens: {},
          },
        }),
      });

      const data: BuildingEditData = { id: 'Q123' };

      await expect(editBuilding(data)).rejects.toThrow('Invalid CSRF token received');
    });
  });

  describe('edit request', () => {
    beforeEach(() => {
      // Mock successful CSRF token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            tokens: {
              csrftoken: 'mock-csrf-token',
            },
          },
        }),
      });
    });

    it('throws when edit request fails with HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const data: BuildingEditData = { id: 'Q123', label: 'Test' };

      await expect(editBuilding(data)).rejects.toThrow('Edit request failed: 403');
    });

    it('throws when edit response contains error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: {
            code: 'permissiondenied',
            info: 'You do not have permission to edit this page',
          },
        }),
      });

      const data: BuildingEditData = { id: 'Q123', label: 'Test' };

      await expect(editBuilding(data)).rejects.toThrow(
        'Wikidata edit error: permissiondenied - You do not have permission to edit this page'
      );
    });

    it('throws when edit response contains error with messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: {
            code: 'failed-save',
            info: 'Save failed',
            messages: [
              { name: 'wikibase-error-sitelink-already-used', parameters: [] },
            ],
          },
        }),
      });

      const data: BuildingEditData = { id: 'Q123', label: 'Test' };

      await expect(editBuilding(data)).rejects.toThrow(
        'Wikidata edit error: failed-save - wikibase-error-sitelink-already-used'
      );
    });

    it('throws when success flag is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const data: BuildingEditData = { id: 'Q123', label: 'Test' };

      await expect(editBuilding(data)).rejects.toThrow('Edit failed: No success response');
    });

    it('succeeds with valid response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: 1,
          entity: {
            id: 'Q123',
            lastrevid: 12345,
          },
        }),
      });

      const data: BuildingEditData = { id: 'Q123', label: 'Test' };

      await expect(editBuilding(data)).resolves.toBeUndefined();
    });

    it('sends correct authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: 1,
          entity: { id: 'Q123', lastrevid: 12345 },
        }),
      });

      const data: BuildingEditData = { id: 'Q123' };
      await editBuilding(data);

      // Check the edit request (second call)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const editCall = mockFetch.mock.calls[1];
      expect(editCall[1].headers.Authorization).toBe('Bearer mock-token');
    });
  });

  describe('abort signal', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          query: {
            tokens: { csrftoken: 'token' },
          },
        }),
      });
    });

    it('passes abort signal to fetch requests', async () => {
      const controller = new AbortController();
      const data: BuildingEditData = { id: 'Q123' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { tokens: { csrftoken: 'token' } },
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: 1, entity: { id: 'Q123' } }),
      });

      await editBuilding(data, controller.signal);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal })
      );
    });
  });
});
