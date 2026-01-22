// Domain mapping for DOI resources to table rows.
import type { DoiResource } from '@/api/types';
import { mapStatus } from '@/domain/doi/statusMapping';

// Table row model used by the UI layer.
export type DoiRow = {
  doi: string;
  status: string;
  prefix: string;
  title: string;
  publicationYear: string;
};

// Convert a DOI resource payload into a UI-friendly row.
export const toDoiRow = (resource: DoiResource): DoiRow => {
  const attributes = resource.attributes ?? {};
  const titles = Array.isArray(attributes.titles) ? attributes.titles : [];
  const title = titles.find((item) => typeof item?.title === 'string')?.title ?? 'Untitled';
  return {
    doi: attributes.doi ?? resource.id ?? 'Unknown',
    status: mapStatus(attributes.state ?? attributes.status),
    prefix: attributes.prefix ?? (attributes.doi?.split('/')[0] ?? 'N/A'),
    title,
    publicationYear: attributes.publicationYear ? String(attributes.publicationYear) : 'N/A'
  };
};
