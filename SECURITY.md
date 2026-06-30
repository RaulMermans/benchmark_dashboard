# Security Policy

## Public Demo Scope

This repository is a static portfolio demo using synthetic benchmark data. It should not contain private company data, client data, personal data, credentials, API keys, or private screenshots.

## Reporting Issues

If you find a security issue or accidentally exposed private material, open a private report through GitHub security advisories when available, or contact the repository owner through the public portfolio contact channel.

Do not include secrets, tokens, passwords, or private datasets in public issues.

## Environment Variables

No environment variables are required for the public demo.

Optional variables:

- `VITE_BENCHMARK_API_URL`
- `VITE_CI_API_URL`
- `VITE_TIMESFM_API_URL`

Do not commit `.env.local`, credentials, private URLs, or API keys.

## Public Data Rules

- Demo data must remain synthetic.
- Raw JSON should use `data.source_monthly`.
- Forecast rows are generated at runtime and should not be stored in the public JSON.
- Derived benchmark fields are generated in code and should not be stored in raw source rows.
