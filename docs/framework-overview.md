# Framework Overview

The project is a framework-ready benchmark dashboard. It keeps the React UI intact while moving reusable data work into explicit layers.

## Layers

```text
Simple Monthly Data / Mock JSON
-> Adapter
-> Schema Validator
-> Benchmark Engine
-> View Models
-> React Dashboard
```

## Reusable Parts

- `src/framework/schema/` validates payload shape and reports row count, companies, markets, date range, forecasts, events, warnings, and errors.
- `src/framework/core/` contains pure calculation functions. These modules do not depend on React and do not mutate inputs.
- `src/framework/adapters/` converts source data into benchmark-ready payloads.
- `src/framework/view-models/` prepares chart/table-friendly objects so React components do less data shaping.
- `src/framework/config/` centralizes dashboard defaults and key customization points.

## Dashboard Boundary

`src/App.jsx` still owns the current UI, routing, controls, and Recharts rendering. The app now builds a framework dataset at the load boundary and uses config for important defaults such as company IDs, metric defaults, labels, and market defaults.
