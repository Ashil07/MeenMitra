# MeenMitra — frontend

Next.js frontend for **MeenMitra** (ಮೀನ್‌ಮಿತ್ರ, "Fish Friend"), a hackathon MVP that gives small fish
farmers in coastal Karnataka early warning of overnight oxygen crashes. It also covers
water-quality checks and sends Kannada alerts with an English translation.

This folder contains only the frontend. The FastAPI backend, the prediction engine, ML, datasets and
real messaging are owned separately. The frontend runs fully on its own in **demo mode**.

## Quick start

```bash
cd frontend
npm install
cp .env.example .env.local      # optional: defaults to demo mode
npm run dev                     # http://localhost:3000
```

Production build: `npm run build && npm start`.

## Modes

| `NEXT_PUBLIC_API_MODE` | What happens |
|---|---|
| `mock` (default) | Typed demo fixtures run in the browser (`src/api/mock`). Data is fictional and labelled **Demo data** throughout. State persists in `localStorage`. Use **Reset demo data** in the sidebar to restore the seed. Nothing is sent anywhere. |
| `live` | Calls the backend at `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`) under `/api/v1/...`. Failures are shown as error states with a retry. The client **never** falls back to demo data. |

Both variables are inlined at build time, so restart `npm run dev` or rebuild after changing them.
No secrets belong in these variables because everything `NEXT_PUBLIC_*` reaches the browser.

To switch to the real backend:

```bash
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

The backend must allow CORS from `http://localhost:3000`.
The contract the frontend expects is in [API_CONTRACT.md](API_CONTRACT.md). It is a **draft** that still needs the backend owner's agreement.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint (`eslint-config-next`, including React hooks rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest: API client, mock contract behaviour and component flows |

## Screens

| Route | What it shows |
|---|---|
| `/` | Dashboard: pond counts, needs-attention list, featured forecast curve, risk distribution, trend, latest alerts |
| `/ponds`, `/ponds/new`, `/ponds/[id]`, `/ponds/[id]/edit` | Pond list with search and filters, registration, detail tabs (overview, forecast, water checks, alerts, 7 AM check-in), editing |
| `/forecast` | Forecast explorer: scenario selector, weather sliders, feeding toggle, rerun, hourly curve with table, factors, suggested actions, alert preview |
| `/water-check` | pH, temperature, ammonia and nitrite readings plus symptoms; rules result with next steps and the fisheries-officer warning |
| `/alerts` | Alert centre: Kannada and English preview, WhatsApp/SMS/voice selection, simulated send (including a simulated failure), delivery timeline, farmer reply, filters |
| `/cooperative` | Priority list, risk distribution, possible outbreak clusters, ponds grouped by canal (schematic, not a map), anonymised reports |
| `/approach` | Interactive 9-layer pipeline, with status per layer taken from `/ml/status` |
| `/models` | Datasets, provenance, load status, record counts, schema, training status and metrics, exactly as reported by the backend |

## Honesty rules built into the UI

- Oxygen values are always labelled **Model estimate**. Test-kit values are labelled **Farmer measured**.
- Demo fixtures are labelled **Demo data**. The mock forecast is a fixture curve (`model.name = "demo-fixture"`), not the MeenMitra engine.
- Every send is marked **Simulated** unless the backend reports `simulated: false`.
- The ML layer and model metrics are shown only as the backend reports them. Demo mode reports nothing as trained or downloaded.
- Outbreak clusters are "possible — not confirmed".
- Disease diagnosis and treatment are always referred to a fisheries officer.

## Structure

```
src/
  api/          types.ts (draft contract), client.ts (interface), live.ts (fetch client),
                errors.ts, config.ts, mock/ (seed, fixture generators, Kannada templates)
  app/          routes (App Router), globals.css design tokens
  components/   AppShell, charts (SVG, no chart library), forms, alert/forecast/water panels
  lib/          time (IST formatting), labels, useApi hooks
```

## Troubleshooting

- **`npm test` fails with "Cannot find native binding … @rolldown/binding-…":** npm sometimes skips the optional native binary (npm/cli#4828). On Windows x64, run `npm install --no-save @rolldown/binding-win32-x64-msvc@<rolldown version>`. Check the version with `npm ls rolldown`.
- **`npm audit` reports high-severity issues:** they come from `braces`/`micromatch` inside `eslint-config-next`, which is lint-time tooling. None of it is shipped to the browser.

## Known limitations

- **Mock mode is a stand-in:**
  - The forecast curve and water rules are simplified stubs that exercise the UI. They are not validated science.
  - The dashboard trend history is illustrative.
- **Kannada text:** the templates are drafts and have not been reviewed by a native speaker. Tulu is not supported.
- **Farmer replies:** these are recorded by a button in the UI. Real replies would come from provider webhooks.
- **Maps:** the cooperative view groups ponds by canal name. No maps or coordinates are used.
- **Not verified against a real backend:** live mode has only been checked against a throwaway stub that tests error handling.
- **OneDrive:** keeping `node_modules` inside a OneDrive folder makes installs slow. Pause syncing, or clone the project outside OneDrive.
