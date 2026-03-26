# Less Paper – Inoffizielle Paperless-ngx App für Android

Eine privat entwickelte Android-App für [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx), die das Verwalten und Lesen deiner Dokumente unterwegs ermöglicht.

> **Hinweis:** Diese App ist eine inoffizielle Drittanbieter-Anwendung und steht in keiner Verbindung zu Paperless-ngx oder dessen Entwicklern. Alle Rechte an Paperless-ngx liegen bei den jeweiligen Urhebern.

---

## Features

- **Dokumentenliste** – Alle Dokumente deines Paperless-ngx-Servers auf einen Blick
- **Volltextsuche** – Suche nach Titel, Inhalt oder Korrespondent; Treffer werden im PDF gelb markiert
- **Filter** – Nach Tags, Dokumenttyp, Korrespondent, Datum und mehr filtern
- **Kachel- & Listenansicht** – Umschalten zwischen kompakter Liste und großer Vorschau-Kachelansicht
- **Offline-Modus** – Dokumente lokal speichern und ohne Internetverbindung lesen
- **Sync** – Lokalen Cache mit dem Server abgleichen (neue Dokumente laden, gelöschte entfernen)
- **PDF-Viewer** – Integrierter Viewer mit Pinch-to-Zoom, Pan und Doppeltipp-Reset
- **Dokument hochladen** – PDFs und Bilder direkt aus der App an Paperless-ngx senden
- **Benutzerfilter** – Bei Mehrbenutzer-Installationen gezielt Dokumente bestimmter Nutzer anzeigen
- **Einstellungen** – Speicherverbrauch, Benutzerfilter, Fehler melden, Abmelden

---

## Voraussetzungen

- Ein laufender [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx)-Server (v1.14+)
- Android 7.0 (API 24) oder neuer

---

## Installation

Die App ist aktuell nicht im Google Play Store verfügbar. Die `.aab`-Datei (oder `.apk`) kann manuell auf dem Gerät installiert werden.

1. [Releases](https://github.com/boernie77/paperless-mobile-app/releases) aufrufen
2. Aktuelle Version herunterladen
3. Auf dem Android-Gerät installieren (Installation aus unbekannten Quellen muss erlaubt sein)

---

## Technik

| Technologie | Zweck |
|---|---|
| [Preact](https://preactjs.com/) + [@preact/signals](https://github.com/preactjs/signals) | UI & Reaktivität |
| [Capacitor](https://capacitorjs.com/) | Native Android-Bridge |
| [Dexie.js](https://dexie.org/) | Lokale Datenbank (IndexedDB) für Offline-Dokumente |
| [PDF.js](https://mozilla.github.io/pdf.js/) | PDF-Rendering im Browser |
| [Vite](https://vitejs.dev/) | Build-Tool |
| TypeScript | Typsicherheit |

---

## Entwicklung & Build

```bash
# Abhängigkeiten installieren
npm install

# Web-Assets bauen
npm run build

# Mit Android synchronisieren
npx cap sync android

# Android-App bauen (AAB)
cd android && ./gradlew bundleRelease
```

---

## Entwickler

Privat entwickelt von **Christian Bernauer**
Website: [byboernie.de](https://byboernie.de)
Kontakt: christian@bernauer24.com

---

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE).
Das Paperless-ngx-Logo steht unter der GPLv3-Lizenz und gehört den Entwicklern von Paperless-ngx.
