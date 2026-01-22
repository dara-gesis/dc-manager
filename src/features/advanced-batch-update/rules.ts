// Form-to-domain mapping for advanced batch rules.
import type { BatchOperation } from '@/domain/batch/operations';

// Shape of values read from the DOM inputs.
export type OperationFormValues = {
  attribute: string;
  pattern: string;
  replacement: string;
  conditionAttribute: string;
  conditionPattern: string;
};

// Build a domain operation from raw form input values.
export const buildOperation = (values: OperationFormValues): BatchOperation => {
  const operation: BatchOperation = {
    attribute: values.attribute.trim(),
    pattern: values.pattern.trim() || undefined,
    replacement: values.replacement
  };

  if (values.conditionAttribute.trim() && values.conditionPattern.trim()) {
    operation.condition = {
      attribute: values.conditionAttribute.trim(),
      pattern: values.conditionPattern.trim()
    };
  }

  return operation;
};

// Extract-and-set is enabled when a condition exists and replacement is empty.
export const isExtractAndSet = (operation: BatchOperation): boolean => {
  return Boolean(
    operation.condition?.pattern && (!operation.replacement || operation.replacement.trim() === '')
  );
};

// Read all operation blocks from the DOM into domain operations.
export const readOperationsFromDom = (container: HTMLElement): BatchOperation[] => {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('.operation-block'));
  return blocks
    .map((block) => {
      const attribute = (block.querySelector('[name="attribute"]') as HTMLInputElement | null)
        ?.value;
      if (!attribute) return null;
      const values: OperationFormValues = {
        attribute,
        pattern: (block.querySelector('[name="pattern"]') as HTMLInputElement | null)?.value ?? '',
        replacement:
          (block.querySelector('[name="replacement"]') as HTMLTextAreaElement | null)?.value ?? '',
        conditionAttribute:
          (block.querySelector('[name="condition_attribute"]') as HTMLInputElement | null)?.value ?? '',
        conditionPattern:
          (block.querySelector('[name="condition_pattern"]') as HTMLInputElement | null)?.value ?? ''
      };
      return buildOperation(values);
    })
    .filter((item): item is BatchOperation => Boolean(item));
};
