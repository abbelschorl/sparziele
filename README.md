# Sparziele 🎯

![Sparziele](./og-image.png)

Eine schlanke **Progressive Web App** zum Anlegen und Verfolgen finanzieller Sparziele –
ein Feature-Prototyp inspiriert von der **Finanzfluss-Copilot**-App.

Lege Ziele wie *Notgroschen*, *Urlaub* oder *ETF-Anlage* an und sieh auf einen Blick,
wie weit du bist und **wann** du dein Ziel erreichst.

**🔗 Live:** Landingpage <https://abbelschorl.github.io/sparziele/> · Demo <https://abbelschorl.github.io/sparziele/app/>

![Tests](https://github.com/abbelschorl/sparziele/actions/workflows/test.yml/badge.svg)
![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-kein_Build-4f46e5)
![PWA](https://img.shields.io/badge/PWA-offline--f%C3%A4hig-4f46e5)
![Daten](https://img.shields.io/badge/Daten-localStorage-4f46e5)
![License](https://img.shields.io/badge/License-MIT-4f46e5)

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

## 📸 Screenshots

> _Platzhalter – eigene Screenshots einfügen (`Cmd+Shift+4`), im Ordner `docs/` ablegen und Pfade unten anpassen._

| Übersicht (hell) | Dunkelmodus | Ziel anlegen |
|---|---|---|
| ![Übersicht](docs/screenshot-light.png) | ![Dunkelmodus](docs/screenshot-dark.png) | ![Formular](docs/screenshot-form.png) |

Für ein animiertes GIF (App in Aktion) eignet sich die macOS-Bildschirmaufnahme (`Cmd+Shift+5`).

---

## 🚀 Lokal starten

Die App braucht **keinen Build-Schritt**, aber einen lokalen Server (für ES-Module + Service Worker):

```bash
# Variante A – Python (vorinstalliert auf macOS/Linux)
python3 -m http.server 5173
# -> http://localhost:5173         (Landingpage)
# -> http://localhost:5173/app/    (die App direkt)

# Variante B – Node
npx serve -l 5173 .
```

> Direktes Öffnen über `file://` funktioniert nicht (Module/Service Worker brauchen `http(s)`).

---

## 📦 Projektstruktur

```
Sparziele/
├── index.html                  # Landingpage (Portfolio / Recruiter)
├── landing/landing.css         # Styles der Landingpage
├── app/                        # die PWA (eigenständig lauffähig)
│   ├── index.html              # App-Shell (relative Pfade)
│   ├── css/styles.css          # Design-Token-System + Komponenten
│   ├── js/{app,storage,calc}.js
│   ├── manifest.webmanifest    # PWA-Manifest
│   ├── sw.js                   # Service Worker (Offline)
│   └── icons/                  # App-Icons (SVG + PNGs)
├── tools/gen-icons.mjs         # Generiert die PNG-Icons aus icon.svg
└── .github/workflows/          # Auto-Deploy zu GitHub Pages
```

Alle Pfade in der App sind **relativ** – sie läuft dadurch unverändert unter `/app/`,
in jedem Unterordner und unter `https://<user>.github.io/<repo>/`.

---

## 🌐 Auf GitHub Pages deployen

```bash
# 1) Repo initialisieren (bereits geschehen, falls du dieses Verzeichnis erhalten hast)
git init -b main
git add -A
git commit -m "Sparziele PWA"

# 2) Leeres Repo auf github.com anlegen (z. B. „sparziele"), dann verbinden:
git remote add origin https://github.com/abbelschorl/sparziele.git
git push -u origin main
```

Anschließend einmalig in GitHub: **Settings → Pages → Build and deployment → Source: „GitHub Actions"**.
Der mitgelieferte Workflow (`.github/workflows/deploy.yml`) deployt dann bei jedem Push auf `main` automatisch.

**Live-Links** danach:
- Landingpage (Portfolio): <https://abbelschorl.github.io/sparziele/>
- App direkt: <https://abbelschorl.github.io/sparziele/app/>

> Push braucht statt Passwort einen **Personal Access Token** (Scope `repo`) – oder nutze GitHub Desktop.

---

## 🛠️ Grafiken neu generieren (optional)

```bash
npm install --no-save sharp
node tools/gen-icons.mjs   # App-Icons (PNG) aus app/icons/icon.svg
node tools/gen-og.mjs      # Vorschaubild og-image.png aus tools/og-image.svg
```

---

## 🧩 Architektur

Bewusst schlank und ohne Build-Step – die ausgelieferten Dateien sind exakt der Code.
Die Logik ist in kleine ES-Module getrennt, damit sie testbar und lesbar bleibt:

- **`app/js/storage.js`** – Persistenz: lädt/speichert den Zustand in `localStorage`, legt beim
  Erststart Seed-Daten an, normalisiert eingelesene Ziele.
- **`app/js/calc.js`** – reine Rechen-/Formatier-Funktionen (keine DOM-Zugriffe): Hochrechnung,
  „nächstes erreichbares Ziel", Sortierung, `de-DE`-Formatierung. **Genau hier setzen die Unit-Tests an.**
- **`app/js/app.js`** – dünne UI-Schicht: State-Halten, Rendern, Events, Modals, Service-Worker-Registrierung.

Weil `calc.js` frei von Seiteneffekten ist, lässt es sich in Node ohne Browser testen.

---

## ✅ Tests

Unit-Tests für die Rechen-Logik mit dem **eingebauten Node-Test-Runner** (keine Test-Dependencies):

```bash
npm test          # bzw.  node --test
```

Die Tests (`tests/calc.test.mjs`) prüfen u. a. Prozent/Restbetrag, Monats-Hochrechnung (Aufrunden),
erreichte & übersparte Ziele, Sortierung und Währungsformat. Sie laufen bei jedem Push automatisch
per GitHub Actions (`.github/workflows/test.yml`) → siehe Tests-Badge oben.

---

## 🔧 Technik

- **Vanilla JS** (ES-Module), kein Framework, kein Bundler
- **localStorage** als einzige Persistenz – kein Backend, keine Tracker
- **Service Worker** – network-first für die App-Shell (online immer frisch, offline aus Cache),
  stale-while-revalidate für Schriften
- Schriften: *Space Grotesk* (Beträge) & *Inter* (UI)

---

## 📄 Lizenz

[MIT](./LICENSE) – frei nutzbar.

> Prototyp / Demo – keine echte Finanzberatung.
