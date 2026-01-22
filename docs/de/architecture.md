# Architektur

## Schichten

- **API (`src/api`)**: Reiner Fetch-Client mit typisierten Fehlern.
- **Domain (`src/domain`)**: Pure Logik für DOI-Mapping, Validierung und Batch-Engine.
- **Features (`src/features`)**: Controller, die UI und Domain verbinden.
- **UI (`src/ui`)**: Toasts, Modals, DataTables-Adapter und Komponenten.
- **Utils (`src/utils`)**: Hilfsfunktionen für JSON/XML und Logging.

## Erweiterbarkeit

Neue Features entstehen als Ordner unter `src/features/*`.

## State Stores

- `sessionStore` hält Anmeldedaten ausschließlich im Speicher.
- `uiStore` verwaltet Loading-Flags.
