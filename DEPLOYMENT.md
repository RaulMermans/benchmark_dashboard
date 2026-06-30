# Deployment

## Local Setup

```bash
pnpm install
pnpm test
pnpm build
pnpm validate:data
pnpm audit:public
```

No environment variables are required for the public static demo. With no env vars, the app reads `/data/benchmark-data.json`.

## Vercel Deployment

Recommended settings:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Install command | `pnpm install` |
| Build command | `pnpm build` |
| Output directory | `dist` |

Run these before publishing a release:

```bash
pnpm test
pnpm build
pnpm validate:data
pnpm audit:public
```

## Environment Variables

All variables are optional.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_BENCHMARK_API_URL` | No | Load a live benchmark JSON/API payload instead of the local snapshot |
| `VITE_CI_API_URL` | No | Secondary supported API URL for CI or preview environments |
| `VITE_TIMESFM_API_URL` | No | Advanced optional TimesFM forecast provider endpoint |

If no API URL is set, the static demo uses synthetic local data. If a live API fails, the app falls back to the local snapshot.

## Optional Live API

The API must return either:

- Preferred `data.source_monthly` raw rows.
- Legacy `data.interface` rows.

See [docs/data-contract.md](docs/data-contract.md).

## Optional TimesFM Service

TimesFM is optional only. The Vite app does not require Python, model weights, or a forecast service. The default provider remains `local_engine`.

If you operate the optional service, set:

```dotenv
VITE_TIMESFM_API_URL=http://localhost:8787/forecast
```

Use a hosted service URL in deployed environments. Do not commit private service URLs or credentials.

## Rollback Notes

- Static deploy rollback: redeploy the previous Vercel deployment.
- Data rollback: restore the previous `public/data/benchmark-data.json`.
- API rollback: unset `VITE_BENCHMARK_API_URL` to return to the local synthetic snapshot.
- Forecast rollback: unset `VITE_TIMESFM_API_URL` to return to the local engine.
