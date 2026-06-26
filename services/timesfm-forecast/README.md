# TimesFM Forecast Service

This service is the intended place to run [google-research/timesfm](https://github.com/google-research/timesfm).

The Vite app calls it through the `VITE_TIMESFM_API_URL` environment variable.
The browser app must not import TimesFM directly — Python, JAX, and model weights are server-side only.

## Running locally

```bash
pip install -r requirements.txt
python app.py
```

Set in `.env.local`:
```
VITE_TIMESFM_API_URL=http://localhost:8787/forecast
```

## API

### POST /forecast

Request:
```json
{
  "horizonMonths": 6,
  "series": [
    {
      "id": "focus::Demo Market::revenue",
      "metric": "revenue",
      "frequency": "monthly",
      "values": [125000, 131000, 140000]
    }
  ]
}
```

Response:
```json
{
  "ok": true,
  "provider": "timesfm",
  "model": "timesfm-2.5",
  "forecasts": [
    {
      "id": "focus::Demo Market::revenue",
      "metric": "revenue",
      "point": [150000, 154000, 159000, 163000, 168000, 173000],
      "quantiles": {
        "0.1": [142000, 145000, 148000, 152000, 156000, 160000],
        "0.5": [150000, 154000, 159000, 163000, 168000, 173000],
        "0.9": [160000, 166000, 172000, 177000, 183000, 189000]
      }
    }
  ]
}
```

## Quantile mapping

| Forecast scenario | Quantile used |
|---|---|
| `base_case`    | `0.5` (median) or `point` |
| `conservative` | `0.1` (lower bound) |
| `aggressive`   | `0.9` (upper bound) |

If the TimesFM version you run does not support quantiles, return only `point` and the adapter will use it for all scenarios.
