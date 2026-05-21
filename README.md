# Benchmark Intelligence Framework / Dashboard Template

A reusable React/Vite benchmark dashboard that is structured like a small framework: data contract, adapters, validation, benchmark calculations, view models, and a polished public demo. It is framework-ready, not a generic BI tool. The goal is to make competitive benchmark dashboards faster to configure while keeping the data model explicit and testable.

## Public Demo Data

This repository intentionally uses synthetic/mock data only. It does not contain real company, client, competitor, or market data. The public snapshot in `public/data/benchmark-data.json` is generated demo data used to showcase the dashboard interface, data model, and framework architecture.

Do not commit private exports, client data, `.env.local`, screenshots, ZIP contents, `node_modules`, `dist`, or other delivery/build artifacts.

## Architecture

```text
Simple Monthly Data / Mock JSON
-> Adapter
-> Schema Validator
-> Benchmark Engine
-> View Models
-> React Dashboard
```

Core folders:

| Layer | Path | Purpose |
| --- | --- | --- |
| Schema | `src/framework/schema/` | Validates benchmark payloads and documents required fields |
| Core engine | `src/framework/core/` | Pure functions for normalization, shares, growth, ranks, efficiency, aggregation |
| Adapters | `src/framework/adapters/` | Converts source formats into benchmark payloads |
| View models | `src/framework/view-models/` | Builds chart/table-ready data outside React components |
| Config | `src/framework/config/defaultBenchmarkConfig.js` | Dashboard labels, defaults, metrics, theme, and view switches |
| Dashboard | `src/App.jsx` | React UI using the framework-ready data layer |

## Data Contract

The enriched benchmark payload shape is:

```json
{
  "ok": true,
  "meta": {},
  "data": {
    "interface": [],
    "events": [],
    "dictionary": []
  }
}
```

`data.interface` is the source of truth.

Required row fields:

- `date`
- `period_type`
- `company_id`
- `display_name`
- `type`
- `market`
- `revenue`
- `visits`
- `data_type`

Optional enriched fields include market share, growth, ranks, revenue per visit, indexed metrics, forecast scenario, active state, colors/logos, and event fields. See [docs/data-contract.md](docs/data-contract.md).

## Using Your Own Data

For the fastest path, provide simple monthly rows:

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

Then convert them with `adaptSimpleMonthlyRows()` from `src/framework/adapters/simpleMonthlyAdapter.js`. The adapter calculates market shares, MoM/YoY growth when prior periods exist, ranks, revenue per visit, and share-vs-traffic efficiency.

You can also replace `public/data/benchmark-data.json` with an enriched payload that matches the contract, then run:

```bash
pnpm validate:data
pnpm test
pnpm build
```

## Local Setup

```bash
pnpm install
pnpm dev
```

The app loads `public/data/benchmark-data.json` by default. If `VITE_BENCHMARK_API_URL` is set, `src/lib/api.js` tries that endpoint first and falls back to the local snapshot.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Build the static dashboard |
| `pnpm preview` | Preview the production build |
| `pnpm test` | Run benchmark calculation and validation tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm validate:data` | Validate `public/data/benchmark-data.json` and print a report |
| `pnpm demo:data` | Regenerate the seeded synthetic public data snapshot |
| `pnpm audit:public` | Scan for private paths, private references, and forbidden artifacts |
| `pnpm prepublish:public` | Regenerate demo data, build, and run the public-readiness audit |

## Framework Customization

Most first-pass customization belongs in `src/framework/config/defaultBenchmarkConfig.js`:

- `title` and `subtitle`
- `currency` and `locale`
- `defaultMarket` and `defaultMetric`
- `ownCompanyId` and `benchmarkCompanyId`
- metric labels
- enabled views
- theme tokens

For source integrations, create an adapter that returns the benchmark payload. See [docs/adapter-guide.md](docs/adapter-guide.md).

## Public Safety

Before publishing or deploying:

```bash
pnpm validate:data
pnpm test
pnpm build
pnpm audit:public
```

Keep deployments in demo mode unless the endpoint is safe for public access. Never point a public demo at private or client-connected data.

## Documentation

- [Framework overview](docs/framework-overview.md)
- [Data contract](docs/data-contract.md)
- [Adapter guide](docs/adapter-guide.md)
- [Mock data policy](docs/mock-data-policy.md)
- [Roadmap](docs/roadmap.md)

## License

MIT. See [LICENSE](LICENSE).
