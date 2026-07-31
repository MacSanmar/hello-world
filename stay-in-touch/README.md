# 📒 Stay-in-Touch Tracker

Een persoonlijke CRM: houd bij wie belangrijk voor je is, wanneer je voor het
laatst contact had, wie er bijna jarig is en wie er "due" is voor een check-in.

> The "whoa" is realizing it's been 8 months since you talked to someone you
> care about.

## Features

- **Personen bijhouden** met relatie (familie, goede vriend(in), mentor, …) en
  gewenste contactfrequentie (wekelijks / maandelijks / per kwartaal)
- **Statusberekening**: Achterstallig (rood), Binnenkort (geel), Op schema
  (groen) — gesorteerd op urgentie
- **"Vandaag gesproken"** met één klik, inclusief contactgeschiedenis
- **Verjaardagen** (ook 29 februari), inline op de kaart en in de statsbalk
- **Notities** per persoon, **zoeken en filteren**, **dark mode**
- **Back-up**: exporteren/importeren als JSON — alle data blijft lokaal in je
  browser (localStorage), er is geen server

## Draaien

De app is een statische site zonder buildstap of dependencies. ES-modules
laden niet via `file://`, dus serveer de map:

```bash
cd stay-in-touch
python3 -m http.server 8080
# open http://localhost:8080/
```

Handige URL-parameters: `?demo=1` (voorbeelddata, raakt je opslag niet aan)
en `?theme=light|dark` (thema forceren).

## Testen

```bash
cd stay-in-touch
npm test          # of: node --test
```

De pure logica (datums, status, sortering, import/export) staat in
`js/logic.js` en is volledig getest met Node's ingebouwde testrunner —
zonder DOM, zonder klok (\"vandaag\" is altijd een parameter, rekenwerk via
`Date.UTC`, dus DST-veilig).

Er is ook een end-to-end smoke test die de echte app in headless Chromium
aanstuurt via het DevTools-protocol (zero dependencies):

```bash
cd stay-in-touch
python3 -m http.server 8080 &                  # app serveren
chromium --headless --remote-debugging-port=9223 \
  --user-data-dir=/tmp/stayintouch-profile about:blank &
node tools/smoke.mjs
```

## Structuur

```
stay-in-touch/
├── index.html        # shell: statsbalk, filters, kaartenlijst, dialogen
├── css/style.css     # thema via CSS custom properties (licht/donker)
├── js/logic.js       # pure logica — geen DOM, geen opslag, geen klok
├── js/storage.js     # localStorage-wrapper met in-memory fallback
├── js/app.js         # UI-laag; bouwt DOM XSS-veilig op (geen innerHTML)
├── test/             # node --test unit tests
└── tools/smoke.mjs   # E2E smoke test via Chrome DevTools Protocol
```

## Dataformaat (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "persons": [{
    "id": "uuid",
    "name": "Mama",
    "relationship": "family",
    "frequency": "weekly",
    "lastContact": "2026-07-28",
    "birthday": "06-18",
    "notes": "",
    "contactHistory": [{ "date": "2026-07-28", "note": "" }],
    "createdAt": "2026-01-01"
  }]
}
```

Datums zijn altijd date-only strings; verjaardagen `"MM-DD"` (zonder jaar).
Een export uit de app is 1-op-1 weer importeerbaar.
