// Error thrown for non-2xx HTTP responses.
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// Error thrown when user input fails validation.
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Error wrapper for UI-friendly messaging with optional details.
export class UserFacingError extends Error {
  details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.name = 'UserFacingError';
    this.details = details;
  }
}
