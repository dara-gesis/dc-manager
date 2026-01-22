// Validation utilities for domain-level checks.
import { ValidationError } from '@/api/errors';
import type { BatchOperation } from '@/domain/batch/operations';

// Ensure a DOI is present before issuing API operations.
export const ensureDoi = (doi?: string | null): string => {
  if (!doi) {
    throw new ValidationError('A DOI is required.');
  }
  return doi;
};

// Validate that batch operations meet minimum requirements.
export const validateBatchOperations = (operations: BatchOperation[]): void => {
  if (!operations.length) {
    throw new ValidationError('At least one operation is required.');
  }

  operations.forEach((operation, index) => {
    if (!operation.attribute) {
      throw new ValidationError(`Operation ${index + 1} requires an attribute path.`);
    }
    if (operation.condition?.pattern && !operation.condition.attribute) {
      throw new ValidationError(`Operation ${index + 1} has a condition pattern without an attribute.`);
    }
  });
};
