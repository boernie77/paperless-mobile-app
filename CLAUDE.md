# CLAUDE.md – Paperless Mobile (Android)

## Projektübersicht
**Name:** Paperless Mobile
**Typ:** Android-App (Capacitor + Preact + TypeScript)
**Zweck:** Inoffizielle Paperless-ngx Client-App für Android
**Entwickler:** Christian Bernauer – [byboernie.de](https://byboernie.de)
**GitHub:** https://github.com/boernie77/paperless-mobile-app
**Aktuelle Version:** 1.0.1 (versionCode 23)

## Technik-Stack
| Technologie | Zweck |
|---|---|
| Preact + @preact/signals | UI & globaler Zustand |
| Capacitor (Android) | Native Bridge (HTTP, Kamera, Dateisystem) |
| Dexie.js (IndexedDB) | Lokale Offline-Datenbank |
| PDF.js (pdfjs-dist) | PDF-Rendering im Browser/Canvas |
| Vite + TypeScript | Build-Tool |

## Wichtige Dateien
| Datei | Inhalt |
|---|---|
| `src/app.tsx` | Root-Komponente, Bottom-Navigation (Inbox / Dokumente / Einstellungen), View-Routing |
| `src/store.ts` | Globale Signals: `authState`, `apiSignal`, `filterSignal`, `ownerFilterSignal`, `failedDocsSignal`, `duplicateDocsSignal` |
| `src/api.ts` | `PaperlessAPI`-Klasse – alle API-Aufrufe über `CapacitorHttp` (außer Uploads/Downloads → fetch) |
| `src/db.ts` | Dexie-Datenbankschema für Offline-Dokumente |
| `src/components/DocumentList.tsx` | Hauptliste: Filter, Suche, Offline-Modus, Sync, Listen-/Kachelansicht |
| `src/components/DocumentViewer.tsx` | PDF-Viewer mit Pinch-Zoom, Pan, Doppeltipp-Reset, Suchbegriff-Highlighting |
| `src/components/MainMenu.tsx` | Seitenmenü: Sync, Filter-Chips |
| `src/components/Settings.tsx` | Einstellungsseite: Benutzerfilter-Popup, Speicher, Fehler melden, Über, Abmelden |
| `src/index.css` | Alle Styles inkl. Dark-Mode-Variablen |
| `android/app/build.gradle` | versionCode und versionName |
| `android/app/src/main/res/mipmap-anydpi-v26/` | Adaptive Icon XMLs (Blatt-Logo) |
| `resources/icon-only.svg` | Originales Paperless-ngx Blatt-Logo (Quelle für Android-Icon) |

## Build-Prozess
```bash
npm run build                        # Web-Assets bauen (dist/)
npx cap sync android                 # dist/ → android/app/src/main/assets/public
# versionCode in android/app/build.gradle erhöhen
cd android && ./gradlew bundleRelease  # → app/build/outputs/bundle/release/app-release.aab
git add ... && git commit && git push
```

## Architektur-Entscheidungen

### Offline-Modus
- Offline-Docs werden als Blob + thumbnailBlob in Dexie gespeichert (`is_offline = 1`)
- Wenn `apiSignal` gesetzt aber Netzwerk fehlt → catch-Block lädt alle Offline-Docs auf einmal (kein Paging)
- Online + Offline-Cache vorhanden → zeigt sofort Offline-Docs, ohne API-Paging

### API-Aufrufe
- Alle normalen Requests: `CapacitorHttp` (umgeht CORS auf Android)
- Datei-Downloads und Uploads: `fetch()` (Blob-Handling)

### Globaler Zustand (Signals)
- `ownerFilterSignal`: `null` = alle User, `number[]` = nur diese User-IDs. Wird in `localStorage` persistiert.
- `filterSignal`: aktive Filter (Tags, Korrespondent, Typ, Datum etc.)

### PDF-Viewer
- Rendert jede Seite auf einzelne `<canvas>`-Elemente (scale: 1.5)
- Pinch-to-Zoom + Pan via Touch-Events, `wasPinchingRef` verhindert Doppeltipp-False-Positives
- Suchbegriff-Highlighting: `page.getTextContent()` + Viewport-Transform → gelbe Rechtecke auf Canvas

### Icons
- Adaptive Icon (Android 8+): Foreground = Paperless-ngx Blatt-Logo (`#22c55e`), Background = `#3d4451`
- Pfaddaten stammen aus `resources/icon-only.svg` (Original-SVG)

## Konventionen
- Sprache im Code: Englisch; UI-Texte: Deutsch
- Commit-Format: `v1.0.1 (XX): Kurzbeschreibung`
- Nach jeder Änderung: `npm run build` → `npx cap sync android` → versionCode +1 → `./gradlew bundleRelease` → commit + push

## Bekannte Einschränkungen
- Suchbegriff-Highlighting im PDF: funktioniert nicht, wenn ein Begriff über zwei Text-Chunks aufgeteilt ist
- `getUsers()` erfordert Admin-Rechte auf dem Paperless-Server; fehlt die Berechtigung, wird der Benutzerfilter still ignoriert

## Impressum (in App und README)
Christian Bernauer, Dianastr. 2b, 90547 Stein
christian@bernauer24.com
Diese App ist eine inoffizielle Drittanbieter-App ohne Verbindung zu Paperless-ngx.
