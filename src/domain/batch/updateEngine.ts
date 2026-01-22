// Pure, DOM-free update engine for advanced batch operations.
import type { BatchOperation, UpdateResult } from '@/domain/batch/operations';
import { mapStatus } from '@/domain/doi/statusMapping';

// Convert dot-notation with [] into an array of path parts.
const splitPath = (path: string): string[] => path.replace(/\[\]/g, '.[]').split('.');

// Normalize status/event input to an API event value.
const mapEvent = (value: string): string | null => {
  const normalized = value.toLowerCase().trim();
  if (['publish', 'register', 'hide'].includes(normalized)) {
    return normalized;
  }
  const status = mapStatus(normalized);
  return status === 'unknown' ? null : status === 'findable' ? 'publish' : status === 'registered' ? 'register' : 'hide';
};

// Recursively test if a condition matches a nested path (supports arrays via []).
const checkConditionByPath = (current: unknown, pathParts: string[], pattern: string): boolean => {
  if (!pathParts.length || current === null || current === undefined) return false;
  const [key, ...rest] = pathParts;
  if (key === '[]') {
    return Array.isArray(current) && current.some((item) => checkConditionByPath(item, rest, pattern));
  }
  if (typeof current !== 'object' || current === null || !(key in current)) return false;
  const value = (current as Record<string, unknown>)[key];
  if (rest.length === 0) {
    return new RegExp(pattern).test(String(value));
  }
  return checkConditionByPath(value, rest, pattern);
};

// Recursively extract values with a capturing group for "extract & set" operations.
const extractValuesByPath = (current: unknown, pathParts: string[], pattern: string): string[] => {
  if (!pathParts.length || current === null || current === undefined) return [];
  const [key, ...rest] = pathParts;
  if (key === '[]') {
    if (!Array.isArray(current)) return [];
    return current.flatMap((item) => extractValuesByPath(item, rest, pattern));
  }
  if (typeof current !== 'object' || current === null || !(key in current)) return [];
  const value = (current as Record<string, unknown>)[key];
  if (rest.length === 0) {
    const match = String(value).match(new RegExp(pattern));
    if (!match) return [];
    return [match[1] ?? match[0]];
  }
  return extractValuesByPath(value, rest, pattern);
};

// Recursively update a nested value, creating intermediate objects/arrays when needed.
const updateValueByPath = (
  current: unknown,
  pathParts: string[],
  pattern: string | null,
  replacement: unknown
): boolean => {
  if (!pathParts.length || current === null || current === undefined) return false;
  const [key, ...rest] = pathParts;

  if (key === '[]') {
    if (!Array.isArray(current)) return false;
    return current.reduce((changed, item) => updateValueByPath(item, rest, pattern, replacement) || changed, false);
  }

  if (typeof current !== 'object' || current === null) return false;
  const record = current as Record<string, unknown>;

  if (rest.length > 0) {
    const nextIsArray = rest[0] === '[]';
    if (!(key in record) || (nextIsArray && !Array.isArray(record[key])) || (!nextIsArray && typeof record[key] !== 'object')) {
      record[key] = nextIsArray ? [] : {};
    }
    return updateValueByPath(record[key], rest, pattern, replacement);
  }

  // Special-case for state/event updates to align with DataCite event semantics.
  if (['state', 'event'].includes(key.toLowerCase())) {
    const originalState = String(record.state ?? '').toLowerCase();
    const mapped = typeof replacement === 'string' ? mapEvent(replacement) : null;
    if (!mapped || (pattern && originalState !== pattern.toLowerCase())) {
      return false;
    }
    record.event = originalState === 'findable' ? 'hide' : mapped;
    return true;
  }

  const originalValue = record[key];
  let newValue = originalValue;
  // Replace in-string only when pattern is provided; otherwise direct replacement.
  if (pattern && typeof originalValue === 'string') {
    newValue = originalValue.replace(new RegExp(pattern, 'g'), String(replacement));
  } else if (pattern === null) {
    newValue = replacement;
  }

  if (JSON.stringify(newValue) !== JSON.stringify(originalValue)) {
    record[key] = newValue as unknown;
    return true;
  }
  return false;
};

// Apply a single operation, respecting context-aware list updates.
const applyOperation = (current: Record<string, unknown>, operation: BatchOperation): boolean => {
  const attrPath = operation.attribute;
  const condPath = operation.condition?.attribute;

  const attrListIndex = attrPath.indexOf('[]');
  const condListIndex = condPath ? condPath.indexOf('[]') : -1;

  // If both attribute and condition paths share the same list context, update per item.
  if (
    condPath &&
    attrListIndex !== -1 &&
    attrListIndex === condListIndex &&
    attrPath.substring(0, attrListIndex) === condPath.substring(0, condListIndex)
  ) {
    const basePath = attrPath.substring(0, attrListIndex);
    const remainingAttrPath = attrPath.substring(attrListIndex + 2).replace(/^\./, '');
    const remainingCondPath = condPath.substring(condListIndex + 2).replace(/^\./, '');

    let list: unknown = current;
    if (basePath) {
      for (const key of basePath.split('.')) {
        if (typeof list === 'object' && list !== null && key in (list as Record<string, unknown>)) {
          list = (list as Record<string, unknown>)[key];
        } else {
          return false;
        }
      }
    }

    if (!Array.isArray(list)) return false;

    return list.reduce((changed, item) => {
      const subOp: BatchOperation = {
        ...operation,
        attribute: remainingAttrPath,
        condition: remainingCondPath
          ? { attribute: remainingCondPath, pattern: operation.condition?.pattern ?? '' }
          : undefined
      };
      return applyOperation(item as Record<string, unknown>, subOp) || changed;
    }, false);
  }

  let conditionMet = true;
  if (condPath && operation.condition?.pattern) {
    conditionMet = checkConditionByPath(current, splitPath(condPath), operation.condition.pattern);
  }

  if (!conditionMet) return false;

  let valueToSet = operation.replacement ?? '';
  const isExtractAndSet =
    condPath && operation.condition?.pattern && String(valueToSet).trim() === '';

  if (isExtractAndSet) {
    const extractedValues = extractValuesByPath(current, splitPath(condPath), operation.condition.pattern);
    if (!extractedValues.length) return false;
    valueToSet = extractedValues[0];
  }

  return updateValueByPath(
    current,
    splitPath(attrPath),
    isExtractAndSet ? null : operation.pattern ?? null,
    valueToSet
  );
};

// Apply a list of batch operations and return a summary log.
export const applyBatchOperations = (
  attributes: Record<string, unknown>,
  operations: BatchOperation[]
): UpdateResult => {
  const log: string[] = [];
  let updated = false;

  operations.forEach((operation, index) => {
    const changed = applyOperation(attributes, operation);
    log.push(`Operation ${index + 1}: ${changed ? 'changed' : 'no change'}`);
    if (changed) updated = true;
  });

  return { updated, log };
};
