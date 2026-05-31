# Benchmark Intelligence Framework / Dashboard Template

A framework-ready competitive intelligence dashboard that converts mock or user-provided benchmark data into rankings, market-share views, growth analysis, period aggregation, forecasts, event overlays, profile cards, and executive benchmark insights.

This public repo uses **synthetic mock data only**. No private client data, real brand data, real logos, or private API URLs are included.

## Architecture

```text
Simple monthly data / mock JSON
  -> adapter
  -> schema validator
  -> benchmark engine
  -> view-model builders
  -> React + Vite dashboard
  -> Vercel deployment
```

## What is reusable

- `src/framework/schema` validates the benchmark payload contract.
- `src/framework/core` normalizes rows, calculates shares, ranks, growth, efficiency, and aggregations.
- `src/framework/adapters` converts JSON or simple monthly rows into benchmark payloads.
- `src/framework/view-models` builds chart/table-ready structures.
- `src/framework/config` controls focus company, benchmark company, enabled views, currency, locale, and defaults.
- `src/App.jsx` renders the polished executive dashboard interface.

## Data contract

The dashboard expects:

```json
{
  "ok": true,
  "meta": {},
  "data": {
    "interface": [],
    "events": [],
    "dictionary": []
  }
}
```

`data.interface` is the source of truth. Minimum row fields:

```text
date, period_type, company_id, display_name, type, market, revenue, visits, data_type
```

The public demo includes enriched fields such as market shares, growth, ranks, indexed metrics, revenue per visit, forecast scenario, and event metadata.

## Replace mock data

Replace:

```text
public/data/benchmark-data.json
```

Keep the same payload shape, then run:

```bash
pnpm validate:data
pnpm audit:public
```

For simple monthly rows, use the adapter in `src/framework/adapters/simpleMonthlyAdapter.js`.

## Run locally

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
pnpm preview
```

## Test and validate

```bash
pnpm test
pnpm validate:data
pnpm audit:public
```

## Vercel settings

```text
Framework preset: Vite
Root directory: ./
Install command: pnpm install
Build command: pnpm build
Output directory: dist
```

No environment variables are required for the public mock-data version.

## Portfolio positioning

This project is a public-safe benchmark intelligence framework/template: a polished executive dashboard interface supported by a reusable data contract, validation layer, benchmark calculation engine, adapters, view models, and mock data policy.
