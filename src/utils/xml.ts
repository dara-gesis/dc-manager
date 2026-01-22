// XML helpers for DOI extraction and validation.
import { ValidationError } from '@/api/errors';

// Extract the DOI identifier from DataCite XML payloads.
export const extractDoiFromXml = (xmlString: string): string => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, 'application/xml');
  const identifier = xml.querySelector('identifier[identifierType="DOI"]');
  const doi = identifier?.textContent?.trim();
  if (!doi) {
    throw new ValidationError('Could not find a DOI identifier in the XML file.');
  }
  return doi;
};
