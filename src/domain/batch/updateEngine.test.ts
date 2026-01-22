import { describe, expect, it } from 'vitest';

import type { BatchOperation } from './operations';
import { applyBatchOperations } from './updateEngine';

describe('updateEngine', () => {
  it('updates nested array paths', () => {
    const attributes = {
      titles: [{ title: 'Old title' }, { title: 'Another' }]
    };
    const operations: BatchOperation[] = [
      { attribute: 'titles[].title', pattern: 'Old', replacement: 'New' }
    ];

    const result = applyBatchOperations(attributes, operations);

    expect(result.updated).toBe(true);
    expect(attributes.titles[0].title).toBe('New title');
  });

  it('extracts and sets using capturing group', () => {
    const attributes = {
      creators: [{ name: 'Jane Doe (Dept A)' }]
    };

    const operations: BatchOperation[] = [
      {
        attribute: 'creators[].nameIdentifier',
        replacement: '',
        condition: {
          attribute: 'creators[].name',
          pattern: '.*\\((.*)\\)'
        }
      }
    ];

    const result = applyBatchOperations(attributes, operations);

    expect(result.updated).toBe(true);
    expect(attributes.creators[0].nameIdentifier).toBe('Dept A');
  });
});
