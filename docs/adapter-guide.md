# Adapter Guide

Adapters convert source data into the benchmark payload contract.

## Current Adapter

`src/framework/adapters/simpleMonthlyAdapter.js` accepts normal monthly rows:

```json
[
  {
    "date": "2026-01-01",
    "company_id": "brand_a",
    "display_name": "Brand A",
    "market": "Demo Market",
    "revenue": 125000,
    "visits": 82000
  }
]
```

It adds defaults and calculates:

- revenue and visit market share
- MoM and YoY growth when prior periods exist
- revenue and visit ranks
- revenue per visit
- revenue share vs visit share

## CSV Exports

Future CSV support should parse rows into the simple monthly shape, then call `adaptSimpleMonthlyRows()`. Keep field mapping explicit and validate before rendering.

## Google Sheets

A sheet export should return JSON with one row per company per month. A serverless function or Apps Script can map sheet headers to the simple monthly shape and return the benchmark payload.

## API or Database Exports

Backends can either return the enriched payload directly or return simple monthly rows that an adapter enriches. The dashboard does not require backend dependencies for the public demo.

## Adapter Checklist

- Do not mutate source rows.
- Normalize dates to `YYYY-MM-DD`.
- Keep `company_id` stable across periods.
- Use synthetic/mock data for public demos.
- Run `pnpm validate:data` for static snapshots and `pnpm test` after adapter changes.
