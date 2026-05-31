# Framework overview

This repo combines a polished benchmark dashboard interface with a reusable framework layer.

## Layers

```text
Data source
  -> adapter
  -> schema validation
  -> normalized rows
  -> benchmark calculations
  -> view models
  -> React dashboard
```

The framework code is intentionally independent from React where possible. Pure calculation functions live under `src/framework/core`. UI-specific rendering remains in `src/App.jsx` and `src/components`.
