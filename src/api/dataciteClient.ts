import { ApiError } from '@/api/errors';
import type { ApiResponse, ClientResponse, DoiAttributes, DoiResource } from '@/api/types';

export type DataCiteConfig = {
  apiBaseUrl: string;
  repositoryId?: string | null;
  password?: string | null;
};

export type DoiRepresentation = 'json_full_data' | 'json_attributes' | 'xml';

export class DataCiteClient {
  private apiBaseUrl: string;
  private repositoryId?: string | null;
  private password?: string | null;

  constructor(config: DataCiteConfig) {
    // Normalize base URL once to avoid double slashes in requests.
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, '');
    this.repositoryId = config.repositoryId ?? null;
    this.password = config.password ?? null;
  }

  setApiBaseUrl(apiBaseUrl: string): void {
    // Allow switching between test and production environments on login.
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
  }

  setCredentials(repositoryId: string | null, password: string | null): void {
    // Credentials are kept in memory only; no persistence layer is used.
    this.repositoryId = repositoryId;
    this.password = password;
  }

  private buildHeaders(accept?: string): Headers {
    const headers = new Headers();
    headers.set('Accept', accept ?? 'application/vnd.api+json');
    if (this.repositoryId && this.password) {
      // DataCite uses Basic Auth for repository credentials.
      const encoded = btoa(`${this.repositoryId}:${this.password}`);
      headers.set('Authorization', `Basic ${encoded}`);
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      params?: Record<string, string> | null;
      payload?: unknown;
      accept?: string;
    }
  ): Promise<T> {
    // Always build a full URL so pagination URLs can be absolute or relative.
    const url = new URL(path.startsWith('http') ? path : `${this.apiBaseUrl}${path}`);
    if (options?.params) {
      // Skip empty parameters to avoid noisy URLs and unexpected API filters.
      Object.entries(options.params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
    }

    const headers = this.buildHeaders(options?.accept);
    if (options?.payload) {
      // DataCite requires JSON:API content type for DOI upserts.
      headers.set('Content-Type', 'application/vnd.api+json;charset=UTF-8');
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.payload ? JSON.stringify(options.payload) : undefined
    });

    if (!response.ok) {
      // Parse JSON errors when available, but preserve raw body for debugging.
      const errorBody = await response.text();
      let parsedBody: unknown = undefined;
      try {
        parsedBody = JSON.parse(errorBody);
      } catch {
        parsedBody = errorBody;
      }
      const message =
        typeof parsedBody === 'object' && parsedBody && 'errors' in parsedBody
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (parsedBody as any).errors?.[0]?.title || response.statusText
          : response.statusText;
      throw new ApiError(message, response.status, parsedBody);
    }

    if (response.status === 204) {
      // DELETE returns no content but should still resolve without errors.
      return null as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('json')) {
      // Prefer JSON responses for JSON:API payloads.
      return (await response.json()) as T;
    }

    // Fallback for XML or plain text responses.
    return (await response.text()) as T;
  }

  async login(repositoryId: string): Promise<ClientResponse> {
    // Client lookup validates credentials and provides prefix scopes.
    return this.request<ClientResponse>('GET', `/clients/${repositoryId}`);
  }

  async getDoi(doi: string, representation: DoiRepresentation = 'json_full_data'): Promise<unknown> {
    // DataCite supports multiple accept headers for JSON vs XML DOI payloads.
    const accept =
      representation === 'xml'
        ? 'application/vnd.datacite.datacite+xml'
        : representation === 'json_attributes'
          ? 'application/vnd.datacite.datacite+json'
          : 'application/vnd.api+json';
    return this.request('GET', `/dois/${encodeURIComponent(doi)}`, { accept });
  }

  async *listDois(params: { prefix?: string; query?: string; fields?: string }): AsyncGenerator<DoiResource> {
    // Page size is capped to limit memory usage during long-running batch operations.
    const queryParams: Record<string, string> = { 'page[size]': '100' };
    if (params.prefix) queryParams.prefix = params.prefix;
    if (params.query) queryParams.query = params.query;
    if (params.fields) queryParams['fields[dois]'] = params.fields;

    let nextPageUrl: string | null = '/dois';
    let isFirstRequest = true;

    while (nextPageUrl) {
      // Only apply params on the first request; next links already include them.
      const response = await this.request<ApiResponse<DoiResource[]>>('GET', nextPageUrl, {
        params: isFirstRequest ? queryParams : null
      });
      isFirstRequest = false;
      if (!response?.data?.length) break;
      for (const item of response.data) {
        // Yield items lazily for memory efficiency.
        yield item;
      }
      const nextLink = response.links?.next;
      nextPageUrl = nextLink ? new URL(nextLink).pathname + new URL(nextLink).search : null;
    }
  }

  addDoi(attributes: DoiAttributes): Promise<ApiResponse<DoiResource>> {
    // POST creates a new DOI in the repository.
    return this.request('POST', '/dois', {
      payload: { data: { type: 'dois', attributes } }
    });
  }

  updateDoiAttributes(doiId: string, attributes: DoiAttributes): Promise<ApiResponse<DoiResource>> {
    // PUT updates DOI attributes with JSON:API payload.
    return this.request('PUT', `/dois/${encodeURIComponent(doiId)}`, {
      payload: { data: { type: 'dois', id: doiId, attributes } }
    });
  }

  updateDoiStatus(doiId: string, event: string): Promise<ApiResponse<DoiResource>> {
    // Status updates are modeled as event changes in DataCite.
    return this.updateDoiAttributes(doiId, { event });
  }

  deleteDoi(doiId: string): Promise<void> {
    // Deletions are only supported for draft DOIs.
    return this.request('DELETE', `/dois/${encodeURIComponent(doiId)}`);
  }

  async determineUpsertAction(doiId?: string | null): Promise<'POST' | 'PUT'> {
    // We only read the DOI to determine if it exists; 404 means create.
    if (!doiId) return 'POST';
    try {
      await this.getDoi(doiId);
      return 'PUT';
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return 'POST';
      }
      throw error;
    }
  }

  async uploadDoiFromXml(doi: string, xmlString: string, event?: string | null): Promise<'Created' | 'Updated'> {
    // DataCite requires XML to be base64-encoded when sent in JSON:API.
    const base64Xml = btoa(unescape(encodeURIComponent(xmlString)));
    const attributes: DoiAttributes = { xml: base64Xml, doi };
    if (event) attributes.event = event;
    const action = await this.determineUpsertAction(doi);
    if (action === 'PUT') {
      await this.updateDoiAttributes(doi, attributes);
      return 'Updated';
    }
    // Prefix is required when creating a new DOI.
    attributes.prefix = doi.split('/')[0];
    await this.addDoi(attributes);
    return 'Created';
  }
}
