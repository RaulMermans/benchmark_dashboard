# Data contract

## Preferred input: raw monthly observations

The preferred way to supply data is as raw monthly observations in `data.source_monthly`. The framework adapts them internally into `data.interface` before the dashboard renders.

```json
{
  "ok": true,
  "meta": {
    "dataset_name": "My Benchmark Dataset",
    "currency": "EUR",
    "source_type": "raw_monthly_observations"
  },
  "data": {
    "source_monthly": [
      {
        "date": "2025-01-01",
        "company_id": "focus",
        "display_name": "Focus Brand",
        "market": "Demo Market",
        "type": "own",
        "revenue": 125000,
        "visits": 82000
      }
    ]
  }
}
```

### Required raw fields

| Field | Type | Description |
|-------|------|-------------|
| `date` | `string` | ISO date string, e.g. `"2025-01-01"` |
| `company_id` | `string` | Unique entity identifier |
| `revenue` | `number` | Gross revenue for the period (≥ 0) |
| `visits` | `number` | Visit count for the period (≥ 0) |

### Optional recommended fields

| Field | Default if absent | Description |
|-------|------------------|-------------|
| `display_name` | `company_id` | Human-readable entity name |
| `type` | `"competitor"` | `"own"`, `"competitor"`, or `"benchmark"` |
| `market` | `"default"` | Market or comparison-group label |
| `active` | `true` | Whether to include this row in calculations |

Raw rows must **not** include derived fields such as `market_share_*`, `*_growth`, `rank_*`, `indexed_*`, or `revenue_per_visit`. The framework computes all of these internally from the raw revenue and visits values.

As a shorthand, a bare JSON array of raw monthly rows is also accepted (treated as `source_monthly`).

### Derived metrics computed from raw rows

The pipeline calculates all the following fields automatically:

| Metric | How |
|--------|-----|
| `market_share_revenue` | `revenue / sum(revenue)` per date+market group; benchmark rows excluded |
| `market_share_visits` | `visits / sum(visits)` per date+market group; benchmark rows excluded |
| `revenue_per_visit` | `revenue / visits`; null when visits is zero |
| `monetization_gap` | `market_share_revenue − market_share_visits` |
| `revenue_mom_growth` | MoM change vs prior calendar month; null when prior month missing |
| `visits_mom_growth` | MoM change vs prior calendar month |
| `revenue_yoy_growth` | YoY change vs same month prior year; null when prior year missing |
| `visits_yoy_growth` | YoY change vs same month prior year |
| `indexed_revenue` | Indexed to first valid month (= 100) per company |
| `indexed_visits` | Indexed to first valid month (= 100) per company |
| `rank_revenue` | Descending revenue rank per date+market; benchmark rows excluded |
| `rank_visits` | Descending visits rank per date+market; benchmark rows excluded |
| `rank_share_revenue` | Descending revenue-share rank per date+market |
| `rank_share_visits` | Descending visits-share rank per date+market |

### Synthetic benchmark rows

The pipeline also generates two synthetic rows per date+market+data_type group:

| company_id | Role |
|------------|------|
| `market_total` | Sum of all real-company revenue and visits |
| `market_average` | Average of all real-company revenue and visits |

These rows carry `type: "benchmark"` and `is_synthetic: true`. They are excluded from share denominators and ranks.

---

## Legacy input: enriched interface rows

Legacy payloads using `data.interface` continue to work. This format is supported but no longer the preferred intake.

## Payload shape (legacy)

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

## Required fields per legacy interface row

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
