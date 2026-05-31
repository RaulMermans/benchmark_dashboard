# Adapter guide

Use adapters when your source data is simpler than the full benchmark JSON.

## Simple monthly adapter

Input fields:

```text
date, company_id, display_name, market, revenue, visits
```

The adapter calculates shares, ranks, growth, and efficiency metrics.

Future adapters can target CSV, Google Sheets, REST APIs, Supabase, or warehouse exports.
