# API

## Endpoints

- `GET /clients/{repositoryId}` – verifies credentials and returns prefixes.
- `GET /dois` – lists DOIs with pagination.
- `GET /dois/{doi}` – fetch DOI metadata (JSON or XML).
- `POST /dois` – create a DOI.
- `PUT /dois/{doi}` – update DOI metadata.
- `DELETE /dois/{doi}` – delete draft DOI.

## Authentication

Basic Auth header is generated from repository ID + password. Passwords are stored only in memory.

## Error Semantics

The client throws `ApiError` with HTTP status and details. UI converts errors to user-friendly
messages via toasts.
