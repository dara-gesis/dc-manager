import { describe, expect, it } from 'vitest';

import { validateBatchOperations } from './validators';


describe('validators', () => {
  it('throws when no operations are provided', () => {
    expect(() => validateBatchOperations([])).toThrow('At least one operation');
  });

  it('throws when condition is missing attribute', () => {
    expect(() =>
      validateBatchOperations([
        {
          attribute: 'titles[].title',
          condition: { attribute: '', pattern: '^Report$' }
        }
      ])
    ).toThrow('condition pattern without an attribute');
  });
});
