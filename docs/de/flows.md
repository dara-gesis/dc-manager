# Abläufe

## Login

1. Umgebung wählen, Repository-ID + Passwort eingeben.
2. Client ruft `GET /clients/{repositoryId}` auf.
3. Präfixe füllen die Filterauswahl.

## DOIs listen

1. Präfix und optionalen Query setzen.
2. Client streamt paginierte `GET /dois`-Ergebnisse.
3. Tabelle ermöglicht ZIP-Export.

## Bearbeiten + Speichern

1. JSON/XML-Editor aus einer Zeile öffnen.
2. Metadaten anpassen und speichern.
3. Client wählt POST/PUT basierend auf DOI-Existenz.

## Batch-Upload

1. JSON/XML-Dateien auswählen.
2. Jede Datei wird geparst und erstellt/aktualisiert.

## Erweiterter Batch-Update

1. Operationen definieren (Pfad, Regex, Ersatz, Bedingung).
2. Dry-Run oder Live-Update ausführen.
3. Update-Engine traversiert Arrays rekursiv.

## ZIP-Download

1. JSON/XML/beides wählen.
2. Client lädt DOIs und erstellt ein ZIP.
