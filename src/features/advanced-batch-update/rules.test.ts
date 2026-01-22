import { describe, expect, it } from 'vitest';

import { buildOperation, isExtractAndSet } from './rules';

describe('rules', () => {
  it('detects extract & set mode', () => {
    const operation = buildOperation({
      attribute: 'titles[].title',
      pattern: '',
      replacement: '',
      conditionAttribute: 'titles[].title',
      conditionPattern: '^(.*)$'
    });

    expect(isExtractAndSet(operation)).toBe(true);
  });
});
