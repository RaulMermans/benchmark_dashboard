"""
Minimal TimesFM forecast service.
Exposes POST /forecast consumed by the Vite app via VITE_TIMESFM_API_URL.

Usage:
  pip install -r requirements.txt
  uvicorn app:app --host 0.0.0.0 --port 8787
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np

app = FastAPI(title="TimesFM Forecast Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


class SeriesInput(BaseModel):
    id: str
    metric: str
    frequency: str = "monthly"
    values: list[float]


class ForecastRequest(BaseModel):
    horizonMonths: int = 6
    series: list[SeriesInput]


@app.post("/forecast")
async def forecast(request: ForecastRequest):
    try:
        import timesfm  # noqa: F401 — import here so startup is fast if not installed
    except ImportError:
        return {
            "ok": False,
            "error": "timesfm package is not installed. Run: pip install timesfm",
        }

    tfm = timesfm.TimesFm(
        hparams=timesfm.TimesFmHparams(
            backend="cpu",
            per_core_batch_size=32,
            horizon_len=request.horizonMonths,
            num_layers=20,
            model_dims=1280,
        ),
        checkpoint=timesfm.TimesFmCheckpoint(
            huggingface_repo_id="google/timesfm-2.0-500m-pytorch"
        ),
    )

    forecasts = []
    for s in request.series:
        values = np.array(s.values, dtype=np.float32)
        freq = [0]  # 0 = high-freq / monthly

        point_forecast, quantile_forecasts = tfm.forecast(
            [values], freq=freq, quantile_levels=[0.1, 0.5, 0.9]
        )

        pf = point_forecast[0].tolist()
        q01 = quantile_forecasts[0, :, 0].tolist()
        q05 = quantile_forecasts[0, :, 1].tolist()
        q09 = quantile_forecasts[0, :, 2].tolist()

        forecasts.append({
            "id": s.id,
            "metric": s.metric,
            "point": pf,
            "quantiles": {"0.1": q01, "0.5": q05, "0.9": q09},
        })

    return {
        "ok": True,
        "provider": "timesfm",
        "model": "timesfm-2.5",
        "forecasts": forecasts,
    }
