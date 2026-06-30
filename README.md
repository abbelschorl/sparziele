# Sparziele 🎯

Eine schlanke **Progressive Web App** zum Anlegen und Verfolgen finanzieller Sparziele –
ein Feature-Prototyp inspiriert von der **Finanzfluss-Copilot**-App.

Lege Ziele wie *Notgroschen*, *Urlaub* oder *ETF-Anlage* an und sieh auf einen Blick,
wie weit du bist und **wann** du dein Ziel erreichst.

![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-kein_Build-16a34a) ![PWA](https://img.shields.io/badge/PWA-offline--f%C3%A4hig-16a34a) ![Daten](https://img.shields.io/badge/Daten-localStorage-16a34a)

---

## ✨ Features

- **Ziele anlegen** mit Name, Symbol, Zielbetrag, aktuellem Betrag, monatlicher Sparrate und optionalem Zieldatum
- **Pro Ziel**: animierter Fortschrittsbalken, Prozentsatz, fehlender Betrag und Hochrechnung „*Erreicht in X Monaten · Monat Jahr*"
- **Signature-Detail**: ein helleres „Ghost"-Segment im Balken zeigt, wo du nach dem **nächsten Sparmonat** stehst
- **Gesamtübersicht**: Summe aller Ziele, Gesamtfortschritt und das **nächste erreichbare Ziel**
- **Einzahlen** direkt auf der Karte: Schnellbetrag-Chips (Sparrate, +50 €, +100 €, „Rest auffüllen") erhöhen den aktuellen Stand
- **Bearbeiten & Löschen** – inkl. *Rückgängig* nach dem Löschen
- **Sortierung** nach Fortschritt / Datum / Betrag (wird gespeichert)
- **Hell- & Dunkelmodus** – folgt dem System, manuell umschaltbar, wird gespeichert
- **Leer-Zustand** mit klarem Call-to-Action
- **Offline-fähig** dank Service Worker · installierbar als App
- Mobile-first, responsiv, mit Fokus auf Barrierefreiheit (Tastatur, Fokusringe, `prefers-reduced-motion`)

---

## 🚀 Lokal starten

Die App braucht **keinen Build-Schritt**, aber einen lokalen Server (für ES-Module + Service Worker):

```bash
# Variante A – Python (vorinstalliert auf macOS/Linux)
python3 -m http.server 5173
# -> http://localhost:5173

# Variante B – Node
npx serve -l 5173 .
```

> Direktes Öffnen der `index.html` über `file://` funktioniert nicht (Module/Service Worker brauchen `http(s)`).

---

## 📦 Projektstruktur

```
Sparziele/
├── index.html              # App-Shell (relative Pfade)
├── css/styles.css          # Design-Token-System + Komponenten
├── js/
│   ├── app.js              # State, Rendering, Events, SW-Registrierung
│   ├── storage.js          # localStorage + Seed-Daten
│   └── calc.js             # Hochrechnung, Sortierung, de-DE-Formatierung
├── manifest.webmanifest    # PWA-Manifest
├── sw.js                   # Service Worker (Offline-Cache)
├── icons/                  # App-Icons (SVG + PNGs)
├── tools/gen-icons.mjs     # Generiert die PNG-Icons aus icon.svg
└── .github/workflows/      # Auto-Deploy zu GitHub Pages
```

Alle Pfade sind **relativ** – die App läuft sowohl unter `https://<user>.github.io/<repo>/`
als auch in jedem Unterordner.

---

## 🌐 Auf GitHub Pages deployen

```bash
# 1) Repo initialisieren (bereits geschehen, falls du dieses Verzeichnis erhalten hast)
git init -b main
git add -A
git commit -m "Sparziele PWA"

# 2) Leeres Repo auf github.com anlegen (z. B. „sparziele"), dann verbinden:
git remote add origin https://github.com/<DEIN-USERNAME>/sparziele.git
git push -u origin main
```

Anschließend einmalig in GitHub: **Settings → Pages → Build and deployment → Source: „GitHub Actions"**.
Der mitgelieferte Workflow (`.github/workflows/deploy.yml`) deployt dann bei jedem Push auf `main` automatisch.

**Live-Link** danach: `https://<DEIN-USERNAME>.github.io/sparziele/`

---

## 🛠️ Icons neu generieren (optional)

```bash
npm install --no-save sharp
node tools/gen-icons.mjs
```

---

## 🔧 Technik

- **Vanilla JS** (ES-Module), kein Framework, kein Bundler
- **localStorage** als einzige Persistenz – kein Backend, keine Tracker
- **Service Worker** mit cache-first App-Shell und stale-while-revalidate für Schriften
- Schriften: *Space Grotesk* (Beträge) & *Inter* (UI)

> Prototyp / Demo – keine echte Finanzberatung.
