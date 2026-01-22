# API

## Endpunkte

- `GET /clients/{repositoryId}` – prüft Zugangsdaten und liefert Präfixe.
- `GET /dois` – listet DOIs mit Pagination.
- `GET /dois/{doi}` – lädt DOI-Metadaten (JSON oder XML).
- `POST /dois` – erstellt eine DOI.
- `PUT /dois/{doi}` – aktualisiert Metadaten.
- `DELETE /dois/{doi}` – löscht Entwurfs-DOIs.

## Authentifizierung

Basic Auth aus Repository-ID + Passwort. Passwörter bleiben nur im Speicher.

## Fehlersemantik

Der Client wirft `ApiError` mit HTTP-Status und Details. Die UI zeigt nutzerfreundliche Toasts.
