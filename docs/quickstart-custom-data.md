# Quickstart: Connect Your Own Benchmark Data

The dashboard ships with synthetic sample data. You can replace the local JSON snapshot or connect an HTTP API without changing the dashboard components.

## Preferred format: raw monthly observations

Supply one row per company per month with only the raw fields the framework needs. The framework derives all other metrics internally.

```json
{
  "ok": true,
  "meta": { "dataset_name": "My Benchmark", "currency": "EUR", "source_type": "raw_monthly_observations" },
  "data": {
    "source_monthly": [
      { "date": "2025-01-01", "company_id": "focus", "display_name": "Focus Brand", "market": "Demo Market", "type": "own", "revenue": 125000, "visits": 82000 },
      { "date": "2025-01-01", "company_id": "peer_a", "display_name": "Peer Alpha", "market": "Demo Market", "type": "competitor", "revenue": 200000, "visits": 140000 }
    ]
  }
}
```

See `public/data/example-benchmark-data.json` for a minimal copyable example.

## Option 1: Use a local JSON file

1. Copy `public/data/example-benchmark-data.json`.
2. Replace the example entities and values with your own monthly observations.
3. Save the result as `public/data/benchmark-data.json`.
4. Run `pnpm validate:data`.
5. Run `pnpm dev`.
6. Confirm the dashboard header shows `Sample data`.

The file must include `ok: true` and either `data.source_monthly` (preferred) or `data.interface` (legacy).

## Option 2: Use a live API

1. Build an endpoint that returns raw monthly observations or a legacy interface payload:

   ```json
   {
     "ok": true,
     "data": {
       "source_monthly": []
     }
   }
   ```

2. Copy `.env.example` to `.env`.
3. Set the endpoint:

   ```dotenv
   VITE_BENCHMARK_API_URL=https://your-api.example.com/benchmark
   ```

4. Run `pnpm dev`.
5. Confirm the dashboard header shows `Live API`.

`VITE_CI_API_URL` remains supported as a secondary environment variable. `VITE_BENCHMARK_API_URL` takes precedence when both are present.

If the live request fails, the app loads `/data/benchmark-data.json` and shows `Snapshot fallback`. Both sources must use the same payload contract.

## Required raw monthly fields

| Field | Type | Description |
| --- | --- | --- |
| `date` | ISO date string | e.g. `"2025-01-01"` |
| `company_id` | string | Stable entity identifier |
| `revenue` | number (≥ 0) | Gross revenue for the period |
| `visits` | number (≥ 0) | Visit count for the period |

Optional but recommended: `display_name`, `type`, `market`.

Do **not** include pre-computed derived fields (`market_share_*`, `*_growth`, `rank_*`, `indexed_*`, `revenue_per_visit`). The framework computes these internally.

Update entity IDs in `src/config/benchmarkConfig.js` if your identifiers differ from `focus`, `peer_a`, `peer_b`, `market_average`.

## Legacy data.interface format

Legacy payloads with `data.interface` continue to work. Every interface row requires:

| Field | Expected value |
| --- | --- |
| `date` | ISO date such as `2026-01-01` |
| `period_type` | `monthly`, `quarterly`, or `annual` |
| `company_id` | Stable entity identifier |
| `display_name` | Human-readable entity name |
| `type` | `own`, `competitor`, or `benchmark` |
| `market` | Market or comparison-group label |
| `revenue` | Numeric revenue value |
| `visits` | Numeric visit count |
| `data_type` | `actual` or `forecast` |

## Start from the example

Use `public/data/example-benchmark-data.json` as the smallest copyable reference in `source_monthly` format.

Forecast rows are generated at runtime from actual monthly data — do not include them in raw JSON. See [data-contract.md](data-contract.md) for the generated forecast row shape.

## Validation

Run the complete publication check after changing data or source configuration:

```bash
pnpm validate:data
pnpm test
pnpm build
pnpm audit:public
```

- `pnpm validate:data` validates `public/data/benchmark-data.json`.
- `pnpm test` checks framework, config, view-model, and source-classification behavior.
- `pnpm build` confirms the Vite production bundle compiles.
- `pnpm audit:public` checks the repository for unsafe public content.

## Aggregation and period intelligence

Raw monthly data is still the preferred intake. The framework now derives annual and custom-range benchmark intelligence internally via `aggregatePeriods`.

After summing revenue and visits per company per period, all benchmark metrics are recalculated from scratch:

- Annual market share = annual company revenue / annual market revenue (not an average of monthly shares)
- Annual ranks are recalculated from aggregated values
- Synthetic `market_total` and `market_average` rows are generated per aggregated period

Available helpers:
- `getAvailableYears(rows)` — distinct years in actual rows
- `getAvailableDateRange(rows)` — `{ min_date, max_date }` from actual rows
- `getLatestCompleteMonth(rows)` — most recent month where all companies have data
- `buildCoverageMetadata(rows)` — month count, company count, and missing-month detection

`data.interface` legacy payloads remain fully supported.

## Forecasting

The framework generates forecast rows automatically from actual `revenue` and `visits` timeseries.

**Architecture:**
- Provider interface: `src/framework/forecasting/generateForecastRows.js`
- Intended production provider: **Google TimesFM** (`google-research/timesfm`)
- The Vite app does **not** run TimesFM directly. Python, JAX/PyTorch, and model weights run in `services/timesfm-forecast/` (server-side only).
- Local deterministic fallback: `local_fallback` — uses trailing growth rates, no network or model files required.
- Forecast rows are appended to `data.interface` after the normal pipeline runs.

**To use the TimesFM provider:**

```bash
cd services/timesfm-forecast
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8787
```

Add to `.env.local`:
```
VITE_TIMESFM_API_URL=http://localhost:8787/forecast
```

If `VITE_TIMESFM_API_URL` is not set, the local fallback runs automatically. The dashboard renders actual data regardless of forecast provider availability.

**Raw JSON should not include forecast rows.** They are generated at runtime from `revenue` and `visits`. Do not include `market_share_*`, `rank_*`, or other derived fields in forecast rows — these are recalculated by the same derived-metrics engine.

## Common mistakes

- Omitting `ok: true`.
- Including pre-computed derived fields (`market_share_*`, growth, ranks, indexed, efficiency) in `source_monthly` rows — the framework computes all of these, plus synthetic `market_total` and `market_average` rows, aggregated period metrics, and forecast rows.
- Including forecast rows in raw JSON — forecasts are generated at runtime and must not be in the source data file.
- Supplying non-numeric strings for `revenue` or `visits`.
- Using inconsistent `company_id` values across periods.
- Using entity IDs that do not match `src/config/benchmarkConfig.js`.
- Omitting comparable historical periods needed for growth calculations.
- Setting the environment variable but not restarting the Vite development server.
- Forgetting that a failed live API intentionally produces `Snapshot fallback` when the local snapshot is valid.
