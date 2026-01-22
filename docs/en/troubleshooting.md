# Troubleshooting

## CORS Issues

Use the DataCite API directly; ensure the API allows browser access from your origin.

## Auth Errors

- Verify repository ID and password.
- Make sure the repo has a password configured.

## Rate Limits

Large batch updates can hit rate limits. Use smaller filters and retry if needed.

## Validation Errors

Ensure JSON files include a `doi` field and XML files contain a DOI identifier.
