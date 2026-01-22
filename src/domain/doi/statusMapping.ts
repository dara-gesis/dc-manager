// Normalized DOI status values used in the UI.
export type DoiStatus = 'draft' | 'registered' | 'findable' | 'unknown';

// Map API status strings to normalized status values.
const statusMap: Record<string, DoiStatus> = {
  draft: 'draft',
  registered: 'registered',
  findable: 'findable'
};

// Normalize status strings to a predictable set.
export const mapStatus = (status?: string | null): DoiStatus => {
  if (!status) return 'unknown';
  const normalized = status.toLowerCase();
  return statusMap[normalized] ?? 'unknown';
};

// Translate status into the DataCite event value.
export const statusToEvent = (status: DoiStatus): string | null => {
  if (status === 'findable') return 'publish';
  if (status === 'registered') return 'register';
  if (status === 'draft') return 'hide';
  return null;
};
