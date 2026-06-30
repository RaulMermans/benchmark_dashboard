# Portfolio Case Study: Benchmark Dashboard

GitHub: https://github.com/RaulMermans/benchmark_dashboard

Live demo: _add deployment URL_

## Problem

Benchmark analysis often starts as scattered spreadsheets, screenshots, manual research, and one-off reports. That makes it hard to compare companies consistently or explain what changed over time.

## Goal

Build a raw-data benchmark intelligence dashboard that turns monthly revenue and traffic observations into market-share analysis, rankings, monetization diagnostics, period aggregation, and local scenario forecasts.

## Constraints

- Public-safe synthetic data only.
- No backend requirement.
- No paid API requirement.
- No Python requirement for the default demo.
- Forecasts must be generated at runtime, not stored in JSON.
- Existing dashboard UI should remain stable.

## Architecture

```text
raw monthly observations
-> canonical benchmark pipeline
-> derived benchmark metrics
-> local forecast engine
-> forecast-derived metrics
-> dashboard UI
```

## Data Pipeline

The preferred input is `data.source_monthly`: one row per company per month with `date`, `company_id`, `revenue`, and `visits`.

The framework derives market share, ranks, growth, indexed metrics, revenue per visit, monetization gap, and synthetic benchmark rows. Legacy `data.interface` payloads remain supported.

## Forecast Engine

The default provider is a local statistical forecast engine. It creates conservative, base, and aggressive scenarios from observed revenue and visits, then sends those forecast rows through the same metric derivation pipeline.

TimesFM is optional advanced infrastructure only.

## What Changed Across Sprints

- Moved the demo data contract toward raw monthly observations.
- Centralized benchmark generation in a canonical payload builder.
- Added derived benchmark metrics and period aggregation.
- Added local scenario forecasting with optional TimesFM support.
- Preserved legacy payload compatibility.
- Improved release documentation, public-data rules, and audit coverage.
- Extracted pure helper logic from the large dashboard app file.

## Screenshots Checklist

- Dashboard overview.
- Market share and ranking section.
- Company profile.
- Forecast section.
- Data source and health state.
- Mobile or narrow viewport.

## Technical Highlights

- Canonical raw-to-interface pipeline.
- Runtime-derived benchmark intelligence.
- Forecast rows generated outside the source JSON.
- Static-demo deployment path with optional API integration.
- Backward-compatible profile route aliases.
- Public audit script for private-data and credential risks.

## Limitations

- Demo data is synthetic and not market research.
- Forecasts are scenario projections, not guaranteed predictions.
- The public demo is static by default.
- Some UI copy remains optimized for the original dashboard context and can be further polished after screenshots are selected.

## Future Improvements

- Add final deployed URL.
- Add real screenshots to the README and case study.
- Continue extracting pure helpers from `src/App.jsx`.
- Add visual regression checks for portfolio screenshots.
