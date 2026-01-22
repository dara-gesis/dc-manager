// JSON helpers for parsing/formatting with user-friendly errors.
import { ValidationError } from '@/api/errors';

// Parse JSON and surface validation errors with a consistent message.
export const parseJson = <T>(input: string): T => {
  try {
    return JSON.parse(input) as T;
  } catch (error) {
    throw new ValidationError('Invalid JSON payload.');
  }
};

// Format JSON with indentation for readability in editors/logs.
export const stringifyJson = (value: unknown): string => JSON.stringify(value, null, 2);
