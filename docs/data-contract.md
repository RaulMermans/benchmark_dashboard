# Data contract

## Payload shape

```json
{
  "ok": true,
  "meta": {},
  "data": {
    "interface": [],
    "events": [],
    "dictionary": [],
    "forecasts": [],
    "insights": []
  }
}
```

`ok` must be `true`. `data.interface` must be an array. All other arrays default to empty if absent.

## Required fields per row

Every row in `data.interface` must include:

| Field | Type | Description |
|-------|------|-------------|
| `date` | `string` | ISO date string, e.g. `"2026-01-01"` |
| `period_type` | `string` | `"monthly"`, `"quarterly"`, or `"annual"` |
| `company_id` | `string` | Unique entity identifier, e.g. `"focus"`, `"peer_a"` |
| `display_name` | `string` | Human-readable company name |
| `type` | `string` | `"own"`, `"competitor"`, or `"benchmark"` |
| `market` | `string` | Market label, e.g. `"Demo Market"` |
| `revenue` | `number` | Gross revenue for the period |
| `visits` | `number` | Visit count for the period |
| `data_type` | `string` | `"actual"` or `"forecast"` |

## Optional / derived fields

These fields are computed by the framework when absent. Providing them pre-computed is also accepted.

| Field | Derived from | Notes |
|-------|-------------|-------|
| `market_share_revenue` | `revenue / sum(revenue)` | Excludes benchmark entity by default |
| `market_share_visits` | `visits / sum(visits)` | Excludes benchmark entity by default |
| `revenue_per_visit` | `revenue / visits` | Null when visits is zero |
| `monetization_gap` | `market_share_revenue - market_share_visits` | Also stored as `revenue_share_vs_visit_share` |
| `revenue_mom_growth` | Prior-month comparison | Null when prior month unavailable |
| `revenue_yoy_growth` | Prior-year comparison | Null when prior year unavailable |
| `visits_mom_growth` | Prior-month comparison | |
| `visits_yoy_growth` | Prior-year comparison | |
| `rank_revenue` | Sorted position by revenue | Excludes benchmark entity by default |
| `rank_visits` | Sorted position by visits | Excludes benchmark entity by default |
| `rank_share_revenue` | Sorted by market share revenue | |
| `rank_share_visits` | Sorted by market share visits | |
| `indexed_revenue` | Revenue indexed to base period | |
| `indexed_visits` | Visits indexed to base period | |
| `forecast_scenario` | From `data_type` or explicit field | `"base_case"`, `"conservative"`, `"aggressive"` |

## Entity conventions

The dashboard expects specific `company_id` values that match `src/config/benchmarkConfig.js`:

| company_id | type | Role |
|------------|------|------|
| `focus` | `"own"` | The company being benchmarked |
| `peer_a`, `peer_b` | `"competitor"` | Comparison companies |
| `market_average` | `"benchmark"` | Market benchmark; excluded from share/rank totals |

These IDs are configurable in `benchmarkConfig.identity` and `benchmarkConfig.comparisonSets`.

## Forecast rows

Forecast rows set `data_type: "forecast"` and optionally `forecast_scenario`. The scenario order is defined in `benchmarkConfig.forecast.scenarioOrder`.

## Minimum example row

```json
{
  "date": "2026-01-01",
  "period_type": "monthly",
  "company_id": "focus",
  "display_name": "Focus Brand",
  "type": "own",
  "market": "Demo Market",
  "revenue": 125000,
  "visits": 82000,
  "data_type": "actual"
}
```

## Loading data

The app loads data in this order:

1. **Live API** — if `VITE_BENCHMARK_API_URL` or `VITE_CI_API_URL` is set, the app fetches from that URL with default query params appended.
2. **Local snapshot** — falls back to `/public/data/benchmark-data.json` automatically.

Both sources must return the same payload shape (`ok: true`, `data.interface` array).

## How to connect your own data

1. Match the payload shape above.
2. Set `VITE_BENCHMARK_API_URL` in `.env`:
   ```
   VITE_BENCHMARK_API_URL=https://your-api/benchmark
   ```
3. Ensure your API returns `ok: true` and a `data.interface` array.
4. Keep required fields consistent across all rows.
5. Run `pnpm validate:data` if you replace the local snapshot.
6. Run `pnpm test` and `pnpm build` to verify.
