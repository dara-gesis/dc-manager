// Regex helper to validate user-provided patterns.
import { ValidationError } from '@/api/errors';

// Build a RegExp instance or throw a ValidationError for invalid syntax.
export const safeRegex = (pattern: string): RegExp => {
  try {
    return new RegExp(pattern);
  } catch (error) {
    throw new ValidationError(`Invalid regex pattern: ${pattern}`);
  }
};
