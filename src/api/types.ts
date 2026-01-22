// Attributes payload for DataCite DOI create/update operations.
export type DoiAttributes = Record<string, unknown> & {
  doi?: string;
  prefix?: string;
  event?: string;
  xml?: string;
};

// JSON:API DOI resource wrapper.
export type DoiResource = {
  id?: string;
  type: 'dois';
  attributes: DoiAttributes;
  relationships?: {
    prefixes?: {
      data?: Array<{ id: string }>;
    };
  };
};

// Generic JSON:API response wrapper.
export type ApiResponse<T> = {
  data: T;
  links?: {
    next?: string;
  };
};

// Client lookup response shape from DataCite.
export type ClientResponse = {
  data: {
    id: string;
    attributes: {
      name: string;
      hasPassword: boolean;
    };
    relationships?: {
      prefixes?: {
        data?: Array<{ id: string }>;
      };
    };
  };
};
