import { describe, expect, it, vi } from 'vitest';

import { DataCiteClient } from './dataciteClient';

const mockFetch = (status: number, body: string, headers?: Record<string, string>) => {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'Error',
    text: async () => body,
    json: async () => JSON.parse(body),
    headers: {
      get: (key: string) => headers?.[key] ?? 'application/vnd.api+json'
    }
  });
};

describe('DataCiteClient', () => {
  it('returns POST when DOI does not exist', async () => {
    mockFetch(404, JSON.stringify({ errors: [{ title: 'Not found' }] }));
    const client = new DataCiteClient({ apiBaseUrl: 'https://api.test.datacite.org' });

    await expect(client.determineUpsertAction('10.1234/example')).resolves.toBe('POST');
  });

  it('throws on auth errors', async () => {
    mockFetch(401, JSON.stringify({ errors: [{ title: 'Unauthorized' }] }));
    const client = new DataCiteClient({ apiBaseUrl: 'https://api.test.datacite.org' });

    await expect(client.determineUpsertAction('10.1234/example')).rejects.toThrow('Unauthorized');
  });
});
