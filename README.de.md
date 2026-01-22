# dc-manager

Eine moderne, modulare DataCite-Konsole zum Verwalten, Bearbeiten, Batch-Update und Export von DOIs.

## Funktionen

- Login/Logout mit DataCite-Repositoriumsdaten (nur im Speicher gespeichert).
- DOIs listen und filtern mit einer DataTables-Tabelle.
- JSON/XML-Editor-Modal mit Upsert-Unterstützung.
- Statusänderungen und Löschen von Entwürfen mit Bestätigung.
- Batch-Upload für JSON/XML-Metadaten.
- Erweiterte Batch-Updates mit Bedingungen und rekursiver Array-Verarbeitung.
- ZIP-Export der angezeigten DOIs.

## Schnellstart

```bash
npm install
npm run dev
```

Öffne `http://localhost:5173`, um die App zu nutzen.

## Konfiguration

- `VITE_DEFAULT_API_BASE` in `.env` setzt die Standard-API-URL.
- Wähle Test- oder Produktionsumgebung im Login.

## Sicherheits-Hinweise

- Passwörter werden **nie persistiert**; sie bleiben nur im Speicher der aktuellen Sitzung.
- Teile keine Sitzungen oder Screenshots mit sensiblen Daten.

## Tests

```bash
npm run test
npm run e2e
```

## GitHub Pages Deployment

Dieses Repository enthält einen GitHub-Pages-Workflow, der die Vite-App mit dem korrekten Base
Path baut und den `dist`-Ordner bei Pushes auf `main` deployt.

## Fehlerbehebung

Siehe [docs/de/troubleshooting.md](docs/de/troubleshooting.md).

## Beitragen

Siehe [CONTRIBUTING.md](CONTRIBUTING.md) für Entwicklungs- und PR-Hinweise.
