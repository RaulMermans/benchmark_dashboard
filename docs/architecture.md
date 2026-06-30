# Architecture

## System Shape

```text
raw monthly observations
-> canonical benchmark pipeline
-> generated benchmark metrics
-> generated local forecasts
-> generated forecast metrics
-> dashboard UI
```

## Core Entry Point

`src/framework/core/buildCanonicalBenchmarkPayload.js` is the single framework entry point for payload normalization.

It accepts:

- `data.source_monthly` raw monthly observations.
- Legacy `data.interface` payloads.

For `source_monthly`, the builder validates raw rows, derives actual benchmark metrics, generates forecast rows, enriches forecast rows with the same benchmark metrics, and returns a dashboard-ready `data.interface`.

## Data Ownership

The public JSON owns only raw observations and optional events. Code owns all derived intelligence.

Generated in code:

- Market share.
- Ranks.
- Growth.
- Indexed values.
- Revenue per visit.
- Monetization gap.
- Synthetic benchmark rows.
- Forecast rows.
- Forecast-derived metrics.

## Forecasting

The local forecast engine is the default provider. TimesFM is an optional advanced provider behind `VITE_TIMESFM_API_URL`; it is not required for the public demo.

Forecasts are scenario projections and should not be presented as guaranteed predictions.
