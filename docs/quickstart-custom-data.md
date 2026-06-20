# Quickstart: Connect Your Own Benchmark Data

The dashboard ships with synthetic sample data. You can replace the local JSON snapshot or connect an HTTP API without changing the dashboard components.

## Option 1: Use a local JSON file

1. Copy `public/data/example-benchmark-data.json`.
2. Replace the example entities and metric values with your own structured benchmark data.
3. Save the result as `public/data/benchmark-data.json`.
4. Run `pnpm validate:data`.
5. Run `pnpm dev`.
6. Confirm the dashboard header shows `Sample data`.

The local file must contain the complete response envelope, including `ok: true` and `data.interface`.

## Option 2: Use a live API

1. Build an endpoint that returns:

   ```json
   {
     "ok": true,
     "data": {
       "interface": []
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

## Minimum payload shape

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

`ok` must be `true`. `data.interface` must be an array. The other arrays are optional and default to empty arrays.

## Required `data.interface` fields

Every interface row requires:

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

Update the entity IDs in `src/config/benchmarkConfig.js` if your focus, peers, or benchmark use different identifiers.

## Derived fields

The framework can derive enriched values when they are missing. In particular:

- `revenue_per_visit` is calculated as `revenue / visits`.
- `monetization_gap` is calculated as `market_share_revenue - market_share_visits`.

The framework can also calculate shares, rankings, growth rates, indexed values, and period aggregations from suitable monthly data. See `docs/data-contract.md` for the full field and derivation rules.

## Start from the example

Use `public/data/example-benchmark-data.json` as the smallest copyable reference. Keep its envelope and required row fields, then replace the entities, dates, markets, revenue, and visits.

For simpler monthly input rows, `src/framework/adapters/simpleMonthlyAdapter.js` can build the enriched benchmark payload.

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

## Common mistakes

- Returning an array directly instead of `{ ok: true, data: { interface: [] } }`.
- Omitting `ok: true`.
- Providing `data.interface` as an object or `null`.
- Using inconsistent `company_id` values across periods.
- Using entity IDs that do not match `src/config/benchmarkConfig.js`.
- Mixing percentages represented as `25` with percentages represented as `0.25`.
- Supplying non-numeric strings for `revenue` or `visits`.
- Omitting comparable historical periods needed for growth calculations.
- Setting the environment variable but not restarting the Vite development server.
- Forgetting that a failed live API intentionally produces `Snapshot fallback` when the local snapshot is valid.
