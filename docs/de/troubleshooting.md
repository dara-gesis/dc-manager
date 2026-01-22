# Fehlerbehebung

## CORS-Probleme

Nutze die DataCite-API direkt; stelle sicher, dass die API Browserzugriffe erlaubt.

## Auth-Fehler

- Prüfe Repository-ID und Passwort.
- Stelle sicher, dass ein Passwort gesetzt ist.

## Rate Limits

Große Batch-Updates können Limits erreichen. Filter reduzieren und erneut versuchen.

## Validierungsfehler

JSON-Dateien benötigen ein `doi`-Feld, XML-Dateien einen DOI-Identifier.
