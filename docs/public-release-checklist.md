# Public Release Checklist

## Data

- [x] Public demo uses `data.source_monthly`.
- [x] Demo data contains 144 raw monthly rows.
- [x] Raw JSON has no forecast rows.
- [x] Raw JSON has no `market_total` or `market_average` source rows.
- [x] Raw JSON has no derived benchmark fields.
- [x] Demo data is synthetic.

## Forecasting

- [x] Local engine is the default forecast provider.
- [x] TimesFM is optional only.
- [x] Forecast-derived metrics are generated in code.

## App

- [x] Preferred profile route is `#/company/:id`.
- [x] Legacy `#/empresa/:id` deep links still resolve.
- [x] Locale formatting is centralized in `src/app/locale.js`.
- [x] Bounded helper extraction reduced `src/App.jsx`.

## Documentation

- [x] README is public-ready.
- [x] Deployment docs exist.
- [x] Security policy exists.
- [x] Portfolio case study draft exists.
- [x] Screenshot checklist exists.
- [x] Data contract and custom-data quickstart exist.

## Release Commands

Run before publishing:

```bash
pnpm test
pnpm build
pnpm validate:data
pnpm audit:public
pnpm typecheck
pnpm lint
```

## Remaining Manual Items

- [ ] Add production deployment URL.
- [ ] Capture and commit screenshots.
- [ ] Add screenshot paths to README.
