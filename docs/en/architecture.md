# Architecture

## Layering

- **API (`src/api`)**: Fetch-only DataCite client with typed errors and header handling.
- **Domain (`src/domain`)**: Pure logic for DOI mapping, validation, and batch update engine.
- **Features (`src/features`)**: Controllers that connect UI and domain logic.
- **UI (`src/ui`)**: Toasts, modals, DataTables adapter, and reusable components.
- **Utils (`src/utils`)**: Shared helpers for JSON/XML parsing and logging.

## Extensibility

Add new features by creating a folder under `src/features/*`. Features should only depend on
`src/api`, `src/domain`, `src/ui`, and `src/utils`.

## State Stores

- `sessionStore` holds credentials and session state in memory only.
- `uiStore` tracks loading flags.
