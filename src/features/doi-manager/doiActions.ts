// DOI actions keep API interaction isolated from UI controllers.
import JSZip from 'jszip';

import { ApiError, UserFacingError } from '@/api/errors';
import type { DoiAttributes, DoiResource } from '@/api/types';
import { getClient } from '@/features/auth/authController';
import { parseJson, stringifyJson } from '@/utils/json';

// Fetch the full JSON:API payload and return attributes only.
export const fetchDoiAttributes = async (doi: string): Promise<DoiAttributes> => {
  const client = getClient();
  const response = (await client.getDoi(doi, 'json_full_data')) as { data: DoiResource };
  return response.data.attributes;
};

// Fetch XML for the editor modal.
export const fetchDoiXml = async (doi: string): Promise<string> => {
  const client = getClient();
  return (await client.getDoi(doi, 'xml')) as string;
};

// Upsert JSON attributes (POST or PUT) depending on DOI existence.
export const saveJsonAttributes = async (doi: string, payload: string): Promise<void> => {
  const attributes = parseJson<DoiAttributes>(payload);
  // Preserve the DOI from the row if it isn't in the edited payload.
  if (!attributes.doi) {
    attributes.doi = doi;
  }
  const client = getClient();
  const action = await client.determineUpsertAction(attributes.doi);
  if (action === 'PUT') {
    await client.updateDoiAttributes(attributes.doi, attributes);
  } else {
    // Prefix is required on create calls.
    if (!attributes.prefix && attributes.doi) {
      attributes.prefix = attributes.doi.split('/')[0];
    }
    await client.addDoi(attributes);
  }
};

// XML saves are routed through the API helper that handles base64 encoding.
export const saveXmlAttributes = async (doi: string, payload: string): Promise<void> => {
  const client = getClient();
  await client.uploadDoiFromXml(doi, payload);
};

// Status changes are translated to DataCite event updates.
export const updateDoiStatus = async (doi: string, event: string): Promise<void> => {
  const client = getClient();
  await client.updateDoiStatus(doi, event);
};

// Delete a DOI, surfacing user-friendly messages for policy errors.
export const deleteDoi = async (doi: string): Promise<void> => {
  const client = getClient();
  try {
    await client.deleteDoi(doi);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      throw new UserFacingError('Delete not allowed.', 'Only draft DOIs can be deleted.');
    }
    throw error;
  }
};

// Fetch selected DOIs in the requested formats and compose a ZIP archive.
export const downloadDoisZip = async (
  dois: string[],
  format: 'json_attributes' | 'xml' | 'both'
): Promise<void> => {
  const client = getClient();
  const zip = new JSZip();

  for (const doi of dois) {
    // JSON export is based on attributes-only representation to reduce payload size.
    if (format === 'json_attributes' || format === 'both') {
      const json = (await client.getDoi(doi, 'json_attributes')) as Record<string, unknown>;
      zip.file(`${doi.replace('/', '_')}.json`, stringifyJson(json));
    }
    if (format === 'xml' || format === 'both') {
      const xml = (await client.getDoi(doi, 'xml')) as string;
      zip.file(`${doi.replace('/', '_')}.xml`, xml);
    }
  }

  // Trigger a browser download using a temporary anchor element.
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `dois_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
