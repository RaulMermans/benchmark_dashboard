import { extractForecastFeatures } from "../forecastFeatures.js";
import { scoreConfidence } from "../forecastConfidence.js";

function addMonths(dateStr, months) {
  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10);
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}-01`;
}

function getCalendarMonth(dateStr) {
  return parseInt(dateStr.slice(5, 7), 10);
}

function computeWeightedGrowth(features) {
  const { trailing3Growth, trailing6Growth, historyMonths } = features;
  if (historyMonths < 3) return 0;
  if (trailing6Growth !== null) return 0.6 * trailing3Growth + 0.4 * trailing6Growth;
  return trailing3Growth;
}

function computeVolatilityBuffer(volatility) {
  if (volatility < 0.05) return 0.05;
  if (volatility < 0.10) return 0.10;
  if (volatility < 0.15) return 0.15;
  if (volatility < 0.20) return 0.20;
  return 0.25;
}

function forecastSeries(values, dates, horizonMonths) {
  if (!values.length) {
    const zeros = Array(horizonMonths).fill(0);
    return { point: zeros, lower: zeros, upper: zeros, diagnostics: null, confidence: null };
  }

  const features = extractForecastFeatures(values, dates);

  const confidence = scoreConfidence({
    historyMonths: features.historyMonths,
    missingMonthCount: features.missingMonthCount,
    volatility: features.volatility,
    seasonalityAvailable: features.seasonalityAvailable,
    outlierCount: features.outlierCount,
  });

  const diagnostics = {
    history_months: features.historyMonths,
    volatility: Math.round(features.volatility * 1000) / 1000,
    seasonality_used: features.seasonalityAvailable,
    model_family: "local_statistical_ensemble",
    outlier_count: features.outlierCount,
  };

  const forecastMethod = features.seasonalityAvailable
    ? "ensemble_trend_seasonality"
    : "ensemble_trend";

  const weightedGrowth = computeWeightedGrowth(features);
  const volatilityBuffer = computeVolatilityBuffer(features.volatility);
  const latestValue = values[values.length - 1];
  const lastDate = dates[dates.length - 1];

  const point = [];
  const lower = [];
  const upper = [];

  for (let h = 1; h <= horizonMonths; h++) {
    const forecastDate = addMonths(lastDate, h);
    const calMonth = getCalendarMonth(forecastDate);

    let trend = latestValue * Math.pow(1 + weightedGrowth, h);

    if (features.seasonalityAvailable && features.seasonalityFactors) {
      trend *= features.seasonalityFactors[calMonth] || 1;
    }

    point.push(Math.max(0, Math.round(trend * 100) / 100));
    lower.push(Math.max(0, Math.round(trend * (1 - volatilityBuffer) * 100) / 100));
    upper.push(Math.max(0, Math.round(trend * (1 + volatilityBuffer) * 100) / 100));
  }

  return { point, lower, upper, diagnostics, confidence, forecastMethod };
}

export async function localEngineProvider({ series, horizonMonths }) {
  const forecasts = series.map((s) => {
    const { point, lower, upper, diagnostics, confidence, forecastMethod } =
      forecastSeries(s.values, s.dates, horizonMonths);

    return {
      id: s.id,
      metric: s.metric,
      point,
      quantiles: { "0.1": lower, "0.5": point, "0.9": upper },
      ...(diagnostics ? { forecast_diagnostics: diagnostics } : {}),
      ...(confidence ? { confidence_score: confidence.confidence_score, confidence_reasons: confidence.confidence_reasons } : {}),
      ...(forecastMethod ? { forecast_method: forecastMethod } : {}),
    };
  });

  return {
    ok: true,
    provider: "local_engine",
    model: "local_statistical_ensemble",
    forecasts,
  };
}
