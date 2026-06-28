# Benchmark Dashboard Framework

Reusable benchmark dashboard framework for JSON/API-driven competitive analysis.

This project is a reusable dashboard shell for turning structured benchmark data into rankings, market-share analysis, growth views, forecasts, profile cards, and executive-ready insights. It ships with synthetic sample data by default; replace the local JSON snapshot or connect a live API without redesigning the interface.

This public repo uses **synthetic mock data only**. No private client data, real brand data, real logos, or private API URLs are included.

---

## 30-second summary

Benchmark Intelligence Framework is a reusable dashboard template for competitive and market-performance analysis.

The system:

1. Accepts structured benchmark data.
2. Validates the payload against a defined schema.
3. Normalizes company, market, revenue, traffic, period, and event data.
4. Calculates rankings, market shares, growth, efficiency, and aggregations.
5. Builds chart-ready and table-ready view models.
6. Renders a polished executive dashboard interface.
7. Supports mock-data demos without exposing private client information.

The project is not just a dashboard skin. It is a small business intelligence framework with a reusable data contract, benchmark engine, adapter layer, and presentation system.

---

## What this proves

This project demonstrates that I can:

* Build executive-facing business intelligence dashboards.
* Design reusable data contracts for benchmark and market-comparison systems.
* Separate raw data, validation, calculation logic, view models, and interface rendering.
* Convert business performance data into rankings, growth views, market-share analysis, and strategic insights.
* Build public-safe portfolio demos without exposing private data, logos, or API endpoints.
* Create reusable dashboard infrastructure that can be adapted to different companies, markets, or benchmark categories.
* Translate strategic comparison problems into structured product interfaces.

---

## Why this exists

Competitive intelligence is often scattered across spreadsheets, manual research, screenshots, and isolated reports.

Business teams need faster ways to answer questions such as:

* Who is leading the market?
* Which competitors are growing fastest?
* How is share changing over time?
* Which companies are more efficient?
* What events may explain performance changes?
* How does one focus company compare against the benchmark set?
* What should leadership investigate next?

This framework turns benchmark data into a structured executive interface.

The goal is not only to visualize data.
The goal is to create a reusable intelligence layer for comparison, prioritization, and decision-making.

---

## What it does

### Data ingestion

* Loads benchmark data from JSON or a live API.
* Accepts raw monthly observations (`date`, `company_id`, `revenue`, `visits`) as the preferred intake.
* Adapts raw rows into the internal benchmark payload shape automatically.
* Also accepts legacy enriched `data.interface` payloads.
* Keeps the public demo independent from private APIs or client data.

### Schema validation

* Validates benchmark payload structure.
* Confirms required fields exist.
* Protects the dashboard from malformed or incomplete data.
* Makes the data contract reusable across different benchmark contexts.

### Benchmark calculations

* Normalizes benchmark rows from raw monthly observations.
* Computes market shares, revenue per visit, monetization gap, MoM/YoY growth, indexed metrics, and ranks internally.
* Generates synthetic `market_total` and `market_average` benchmark rows automatically.
* Raw JSON does not need pre-computed derived fields — the framework derives everything from `revenue` and `visits`.
* Aggregates monthly rows into annual or custom-range periods, then recalculates all benchmark metrics from the summed revenue and visits — never by averaging monthly percentages.
* Provides period intelligence helpers: latest complete month, available years, date-range bounds, and coverage metadata including missing-month detection.
* Supports period-based analysis and enriched fields such as forecast scenarios and event metadata.

### Forecasting layer

* Generates forward-looking forecast rows from actual monthly `revenue` and `visits` via a provider-based interface.
* Intended production provider: **Google TimesFM** (`google-research/timesfm`), called through a configurable service endpoint (`VITE_TIMESFM_API_URL`). TimesFM runs server-side only; Python, JAX/PyTorch, and model weights are never bundled into the Vite app.
* Local deterministic fallback (`local_fallback`) is available for tests, offline development, and demo resilience. It uses trailing growth rates and requires no network or model files.
* Supports three forecast scenarios: `base_case` (median/point), `conservative` (lower quantile), `aggressive` (upper quantile).
* After forecast rows are generated, the full derived-metrics pipeline runs on them so charts receive consistent market shares, efficiency metrics, and ranks.
* Raw JSON should not include forecast rows; they are generated at runtime from actual data.

### View-model generation

* Converts calculated benchmark outputs into chart-ready and table-ready structures.
* Separates business logic from UI rendering.
* Makes the dashboard easier to extend, test, and reuse.

### Executive dashboard interface

* Renders rankings, market-share views, growth analysis, forecasts, event overlays, company profile cards, and benchmark insights.
* Provides a polished interface for leadership-style review.
* Focuses on clarity, comparison, and fast interpretation.

---

## What it is not

This project is intentionally scoped.

It is **not**:

* a live market-data product
* a production analytics platform
* a private client dashboard
* a real-time data pipeline
* a financial forecasting engine
* a replacement for verified market research
* a source of real company performance data
* a dashboard containing private brand, client, API, or revenue information

The public version is a framework/template using synthetic mock data.

---

## System architecture

```text
Simple monthly data / mock JSON / live API
  -> adapter
  -> schema validator
  -> benchmark engine (core calculations)
  -> view-model builders
  -> React + Vite dashboard
  -> Vercel deployment
```

### Architecture principles

| Layer            | Responsibility                                                 |
| ---------------- | -------------------------------------------------------------- |
| Data source      | Provides mock or user-provided benchmark rows                  |
| Adapter          | Converts simple monthly rows into the benchmark payload shape  |
| Schema validator | Confirms that the benchmark data contract is valid             |
| Benchmark engine | Calculates shares, ranks, growth, efficiency, and aggregations |
| View models      | Builds chart-ready and table-ready structures                  |
| Dashboard UI     | Renders the executive benchmark interface                      |
| Public audit     | Checks that private or unsafe data is not exposed              |

---

## Framework modules

| Module                                       | Purpose                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/framework/schema`                       | Validates the benchmark payload contract                                                 |
| `src/framework/core`                         | Normalizes rows and calculates shares, ranks, growth, efficiency, and aggregations       |
| `src/framework/core/buildCanonicalBenchmarkPayload.js` | Single-entry canonical pipeline: source_monthly → full enriched payload         |
| `src/framework/adapters`                     | Converts JSON or simple monthly rows into benchmark payloads                             |
| `src/framework/view-models`                  | Builds chart-ready and table-ready data structures                                       |
| `src/framework/config`                       | Controls focus company, benchmark company, enabled views, currency, locale, and defaults |
| `src/framework/forecasting`                  | Provider-based forecasting layer: timeseries prep, local engine, TimesFM adapter, row mapper |
| `src/config/benchmarkConfig.js`              | Centralizes entity IDs, routes, period types, scenario order, and thresholds for the App |
| `src/config/metricRegistry.js`               | Centralizes metric definitions, labels, and named option arrays used across the App      |
| `src/lib/metricFormatters.js`                | Resolves string formatter keys from the registry to formatting functions                 |
| `src/lib/api.js`                             | Loads benchmark data, delegates all pipeline work to the canonical builder               |
| `src/app/routes.js`                          | Route parsing, navigation, and profile hash helpers                                      |
| `src/features/battle/battleLogic.js`         | Pure battle-arena scoring, formatting, and round-building logic                          |
| `src/features/forecast/forecastUtils.js`     | Forecast merge helpers and observed/forecast deduplication utilities                     |
| `src/viewModels/`                            | Wraps framework view-model builders for each dashboard section                           |
| `src/App.jsx`                                | Renders the polished executive dashboard interface                                       |
| `services/timesfm-forecast/`                 | Reference scaffold for the TimesFM Python service (not bundled into the Vite app)        |

The framework is designed so that benchmark logic and interface rendering remain separated.

---

## Data modes

| Mode | When | How |
|------|------|-----|
| **Local snapshot** | No env vars set (default) | Reads `/public/data/benchmark-data.json` |
| **Live API** | `VITE_BENCHMARK_API_URL` set | Fetches from live API; falls back to local snapshot on failure |
| **CI API** | `VITE_CI_API_URL` set | Same as live API |

The dashboard header identifies the active result as `Sample data`, `Live API`, or `Snapshot fallback`.

Both `data.source_monthly` (preferred) and `data.interface` (legacy) are accepted from any source.

The public demo (`public/data/benchmark-data.json`) now uses raw `source_monthly` observations only. All benchmark metrics, forecast rows, and derived fields are generated at runtime by the framework pipeline. The JSON does not store pre-computed forecasts or derived metrics.

## Data contract

### Preferred: raw monthly observations

The preferred input is raw monthly observations in `data.source_monthly`. Supply one row per company per month with only four required fields:

```text
date, company_id, revenue, visits
```

The framework computes all derived metrics (shares, ranks, growth, efficiency) internally.

```json
{
  "ok": true,
  "meta": { "source_type": "raw_monthly_observations" },
  "data": {
    "source_monthly": [
      { "date": "2025-01-01", "company_id": "focus", "display_name": "Focus Brand", "market": "Demo Market", "type": "own", "revenue": 125000, "visits": 82000 }
    ]
  }
}
```

A bare JSON array of monthly rows is also accepted.

### Legacy: enriched interface rows

Payloads with `data.interface` continue to work. Every interface row requires:

```text
date, period_type, company_id, display_name, type, market, revenue, visits, data_type
```

---

See [`docs/data-contract.md`](docs/data-contract.md) for the full field list and derivation rules.

## How to connect your own data

- Read the full [data contract](docs/data-contract.md).
- Follow the [custom-data quickstart](docs/quickstart-custom-data.md).
- Copy the [example benchmark payload](public/data/example-benchmark-data.json) (source_monthly format).

Use local mode by replacing `public/data/benchmark-data.json`, or set `VITE_BENCHMARK_API_URL` to a compatible endpoint. Adjust entity IDs in `src/config/benchmarkConfig.js` when your identifiers differ from the included sample.

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

For simple monthly rows, use the adapter in:

```text
src/framework/adapters/simpleMonthlyAdapter.js
```

This allows simpler datasets to be transformed into the benchmark framework format without rewriting the dashboard.

---

## Public data policy

This repository is designed to be public-safe.

The public version includes:

* synthetic mock data only
* no private client data
* no real brand performance data
* no real logos
* no private API URLs
* no production credentials
* no hidden proprietary benchmark datasets

Before publishing or deploying public changes, run:

```bash
pnpm audit:public
```

The purpose is to demonstrate the framework architecture and dashboard experience without exposing sensitive commercial information.

---

## How to review this repo

Start here:

1. `public/data/benchmark-data.json` — synthetic benchmark dataset used by the demo
2. `src/framework/schema` — benchmark payload validation
3. `src/framework/core` — benchmark calculations and normalization logic
4. `src/framework/adapters` — adapter layer for converting simpler data into benchmark payloads
5. `src/framework/view-models` — chart-ready and table-ready view models
6. `src/framework/config` — dashboard settings, focus company, benchmark company, locale, and defaults
7. `src/config/benchmarkConfig.js` — entity IDs, routes, period types, and thresholds for the App
8. `src/config/metricRegistry.js` — metric definitions, labels, and named option arrays
9. `src/App.jsx` — executive dashboard interface
10. Public audit script — safety check for public data exposure

This repo is best reviewed as a reusable business intelligence framework, not only as a visual dashboard.

---


## Run locally

Install dependencies:

```bash
pnpm install
```

Start local development:

```bash
pnpm dev
```

---

## Screenshots

Screenshots should be added after the public deployment is finalized.

---

## Build

Create a production build:

```bash
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

---

## Test and validate

Run tests:

```bash
pnpm test
```

Validate the benchmark data contract:

```bash
pnpm validate:data
```

Run the public-safety audit:

```bash
pnpm audit:public
```

Recommended validation flow before publishing:

```bash
pnpm test
pnpm validate:data
pnpm audit:public
pnpm build
```

---

## Vercel settings

```text
Framework preset: Vite
Root directory: ./
Install command: pnpm install
Build command: pnpm build
Output directory: dist
```

No environment variables are required for the public mock-data version.

---

## Current limitations

* Public demo uses synthetic mock data only.
* No live market-data integrations are included.
* No private API connection is included.
* Forecasts are demo/framework outputs, not financial predictions.
* The dashboard depends on the expected benchmark payload shape.
* The public version is designed for portfolio and framework demonstration, not production business reporting.
* Real deployment with private data would require authenticated data access, durable storage, authorization, and stronger data governance.

---

## Portfolio relevance

This project demonstrates:

* business intelligence product thinking
* executive dashboard design
* benchmark data modeling
* reusable data contracts and metric registries
* schema validation
* adapter-based data ingestion
* benchmark calculation logic
* chart/table view-model architecture
* configuration-driven design (entity IDs, routes, metrics all centralised)
* public-safe demo design
* strategic data communication
* React + Vite dashboard execution

The main point of the project is not that it displays charts.

The point is that it shows how benchmark data can be structured into a reusable intelligence framework for comparison, prioritization, and executive decision-making.
