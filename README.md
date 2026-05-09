# Benchmark Dashboard Template

Unbranded React/Vite dashboard for benchmark-style market, category, or portfolio data.

The public repository is designed as a reusable template: connect it to a Google Sheets export, database API, warehouse endpoint, or static JSON file and the interface renders rankings, market share, growth, forecast scenarios, event overlays, and executive summary cards.

## Public demo data

The included dataset is **seeded synthetic demo data**. It is intentionally randomized and uses generic entities such as `Focus Brand`, `Peer A`, and `Market Average`.

No real company names, real logos, private endpoints, commercial metrics, or proprietary ranking data are included.

## Data loading model

The dashboard loads data through `src/lib/api.js`:

1. If `VITE_BENCHMARK_API_URL` is configured, the app tries that live JSON endpoint first.
2. If the live endpoint is missing or fails, it falls back to `/data/benchmark-data.json`.
3. The local snapshot can be regenerated with seeded demo values.

Example environment value:

```env
VITE_BENCHMARK_API_URL="https://example.com/api/benchmark-data"
```

The endpoint can be backed by Google Sheets, a database, an ETL job, a serverless function, or any service that returns the expected JSON contract.

## JSON contract

Minimum payload:

```json
{
  "ok": true,
  "meta": { "generated_at": "2026-01-01T00:00:00.000Z", "source": "Your connector name" },
  "data": { "interface": [], "events": [], "dictionary": [] }
}
```

Minimum `data.interface[]` fields:

| Field | Type | Notes |
|---|---:|---|
| `date` | string | `YYYY-MM-DD` preferred |
| `period_type` | string | `monthly`, `quarterly`, or `annual` |
| `company_id` | string | Stable lowercase ID |
| `display_name` | string | Label shown in UI |
| `type` | string | `competitor` or `benchmark` |
| `market` | string | Market/filter label |
| `revenue` | number/null | Optional metric |
| `visits` | number/null | Optional metric |
| `market_share_revenue` | number/null | Decimal, e.g. `0.18` |
| `market_share_visits` | number/null | Decimal, e.g. `0.18` |
| `revenue_yoy_growth` | number/null | Decimal, e.g. `0.12` |
| `visits_yoy_growth` | number/null | Decimal, e.g. `0.12` |
| `data_type` | string | `estimated`, `actual`, or `forecast` |
| `forecast_scenario` | string | Optional: `base_case`, `aggressive`, `conservative` |

Extra fields are supported and used when available: ranks, MoM growth, share movement, indexed values, revenue per visit, events, notes, colors, and strategic signals.

## Commands

```bash
pnpm install
pnpm demo:data
pnpm dev
pnpm build
pnpm audit:public
```

## Scripts

| Script | Purpose |
|---|---|
| `pnpm demo:data` | Regenerates the seeded synthetic snapshot. |
| `pnpm build` | Builds the static app. |
| `pnpm audit:public` | Checks that private/source-specific terms and unsafe files are absent. |
| `pnpm prepublish:public` | Runs demo data generation, build, and public audit. |

## Publishing guidance

Before publishing to GitHub:

```bash
pnpm prepublish:public
```

Do not commit `.env.local`, source repo history, `node_modules/`, `dist/`, private screenshots/logs, real logos, or real benchmark snapshots.

## Portfolio framing

> Built an unbranded benchmark dashboard template that converts spreadsheet/API/database exports into an executive intelligence interface with ranking, share, growth, forecast, and event-analysis views. The public version uses synthetic data while preserving the reusable data contract and connector architecture.
