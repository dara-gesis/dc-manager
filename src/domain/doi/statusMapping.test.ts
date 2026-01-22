import { describe, expect, it } from 'vitest';

import { mapStatus, statusToEvent } from './statusMapping';

describe('statusMapping', () => {
  it('maps known statuses', () => {
    expect(mapStatus('draft')).toBe('draft');
    expect(mapStatus('registered')).toBe('registered');
    expect(mapStatus('findable')).toBe('findable');
  });

  it('returns unknown for missing status', () => {
    expect(mapStatus(undefined)).toBe('unknown');
  });

  it('maps status to events', () => {
    expect(statusToEvent('findable')).toBe('publish');
    expect(statusToEvent('registered')).toBe('register');
    expect(statusToEvent('draft')).toBe('hide');
  });
});
