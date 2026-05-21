# Mock Data Policy

This repository intentionally uses synthetic/mock public data.

Do not commit:

- private company or client data
- private exports or ZIP contents
- `.env.local` or real endpoint secrets
- `node_modules`
- `dist` unless intentionally publishing static build output
- screenshots or delivery artifacts
- hardcoded private machine paths

The public data file is `public/data/benchmark-data.json`. It should remain portfolio-safe and can be regenerated with:

```bash
pnpm demo:data
```

Before publishing, run:

```bash
pnpm validate:data
pnpm audit:public
```
