# Flows

## Login

1. Select environment, enter repository ID + password.
2. The client calls `GET /clients/{repositoryId}`.
3. On success, prefixes populate filter options.

## List DOIs

1. Choose prefix and optional query.
2. The client streams paginated `GET /dois` results.
3. Results render in the table, enabling ZIP export.

## Edit + Save

1. Open JSON/XML editor from table row.
2. Update metadata and save.
3. The client selects POST/PUT based on DOI existence.

## Batch Upload

1. Upload JSON/XML files.
2. Each file is parsed, then created or updated.

## Advanced Batch Update

1. Define operations (attribute, regex, replacement, optional condition).
2. Run dry or live update.
3. Update engine traverses nested arrays and applies changes.

## ZIP Download

1. Choose JSON/XML/both.
2. Client fetches selected DOIs and composes a ZIP.
