// Parser for batch upload files; keeps file handling out of controllers.
import type { DoiAttributes } from '@/api/types';
import { ValidationError } from '@/api/errors';
import { extractDoiFromXml } from '@/utils/xml';
import { parseJson } from '@/utils/json';

export type UploadItem =
  | { type: 'json'; attributes: DoiAttributes }
  | { type: 'xml'; doi: string; xml: string };

// Read file content as text for both JSON and XML payloads.
const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result ?? ''));
    reader.onerror = () => reject(new ValidationError(`Failed to read ${file.name}.`));
    reader.readAsText(file);
  });

// Convert a FileList into typed upload items with validation.
export const parseUploadFiles = async (files: FileList): Promise<UploadItem[]> => {
  const items: UploadItem[] = [];
  for (const file of Array.from(files)) {
    const content = await readFileAsText(file);
    if (file.name.toLowerCase().endsWith('.json')) {
      const attributes = parseJson<DoiAttributes>(content);
      if (!attributes.doi) {
        throw new ValidationError(`File ${file.name} is missing a DOI.`);
      }
      items.push({ type: 'json', attributes });
    } else if (file.name.toLowerCase().endsWith('.xml')) {
      const doi = extractDoiFromXml(content);
      items.push({ type: 'xml', doi, xml: content });
    } else {
      throw new ValidationError(`Unsupported file type: ${file.name}.`);
    }
  }
  return items;
};
