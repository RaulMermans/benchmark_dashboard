---
name: public-demo-readiness
description: Use when preparing this benchmark dashboard template for public GitHub or portfolio publishing. Checks synthetic data, generic connector copy, and absence of private files.
---

# Public Demo Readiness

## Goal

Keep this dashboard safe for public portfolio use while preserving the reusable connector architecture.

## Required checks

1. Run `pnpm demo:data` to regenerate synthetic data.
2. Run `pnpm build` to verify the app compiles.
3. Run `pnpm audit:public` to check for private terms and unsafe files.
4. Confirm the README explains the generic JSON contract and live endpoint option.

## Do not include

- private `.env.local` files
- source repo history
- private screenshots/logs
- real logos
- real company names
- real benchmark snapshots
- hardcoded endpoint URLs
- tokens, keys, spreadsheet IDs, or deployment IDs

## Output contract

Return: files changed, commands run, build result, public audit result, and remaining risks.
