# Hitster Scanner (Web)

Scannt die QR-Codes vom Hitster-Karten-Generator und spielt den Song direkt
in diesem Browser-Tab über das offizielle **Spotify Web Playback SDK** —
kein Backend, kein Build-Schritt, kein App-Store nötig.

**Wichtig:** Zeigt absichtlich nie Titel/Interpret des laufenden Songs an
— das wäre die Antwort des Rate-Spiels.

## Setup (einmalig)

### 1. Auf GitHub Pages veröffentlichen
1. Neues GitHub-Repository erstellen (öffentlich oder privat, beides geht
   mit GitHub Pages)
2. Diese 5 Dateien hochladen: `index.html`, `style.css`, `app.js`,
   `spotify.js`, `README.md`
3. **Settings → Pages** → "Source": `Deploy from a branch` → Branch
   `main`, Ordner `/ (root)` → Speichern
4. Nach ein paar Minuten ist die Seite unter
   `https://DEIN-NUTZERNAME.github.io/DEIN-REPO-NAME/` erreichbar

### 2. Spotify-Dashboard konfigurieren
Du kannst die gleiche Spotify-App wie für den Karten-Generator
weiterverwenden ([developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)):
1. App öffnen → **Settings**
2. Unter **Redirect URIs** genau die GitHub-Pages-URL von oben eintragen
   (die Seite zeigt sie dir zusätzlich direkt an, mit Kopier-Button —
   muss exakt übereinstimmen, inklusive Schrägstrich am Ende)
3. Unter **User Management** deinen eigenen Spotify-Account als Test-User
   hinzufügen (Pflicht im Development Mode)
4. **Client-ID** kopieren (kein Secret nötig — diese Seite nutzt PKCE)

### 3. Seite öffnen
1. GitHub-Pages-URL im Handy- oder Desktop-Browser öffnen
2. Client-ID einfügen, "Client-ID speichern" klicken
3. "Mit Spotify verbinden" klicken, kurz bestätigen
4. Kamera-Zugriff erlauben, Karten scannen

## Voraussetzungen

- Spotify Premium
- HTTPS (GitHub Pages liefert das automatisch — für Kamerazugriff und
  Spotify-Login zwingend notwendig)
- Der Browser-Tab muss beim Spielen offen bleiben (Hintergrund-Tab ist
  okay, Tab schließen oder Browser beenden stoppt die Wiedergabe)

## Dateien

```
index.html    HTML-Struktur, zwei Screens (Login / Scanner)
style.css     Styling
spotify.js    PKCE-Auth-Flow + Web Playback SDK + Web-API-Aufrufe
app.js        QR-Scan-Logik, UI-Verdrahtung
```
