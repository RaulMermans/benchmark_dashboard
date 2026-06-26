function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length);
}

function forecastValues(values, horizonMonths) {
  if (!values.length) {
    const zeros = Array(horizonMonths).fill(0);
    return { point: zeros, lower: zeros, upper: zeros };
  }

  const lookback = Math.min(values.length, 6);
  const recent = values.slice(-lookback);
  const growthRates = [];
  for (let i = 1; i < recent.length; i++) {
    if (recent[i - 1] > 0) {
      growthRates.push(recent[i] / recent[i - 1] - 1);
    }
  }

  const avgGrowth = growthRates.length ? mean(growthRates) : 0;
  const volatility = Math.max(stdDev(growthRates), 0.02);

  let base = recent.at(-1) ?? 0;
  const point = [];
  const lower = [];
  const upper = [];

  for (let i = 0; i < horizonMonths; i++) {
    base = base * (1 + avgGrowth);
    const safe = Math.max(0, base);
    point.push(safe);
    lower.push(Math.max(0, safe * (1 - volatility)));
    upper.push(Math.max(0, safe * (1 + volatility)));
  }

  return { point, lower, upper };
}

export async function localFallbackProvider({ series, horizonMonths }) {
  const forecasts = series.map((s) => {
    const { point, lower, upper } = forecastValues(s.values, horizonMonths);
    return {
      id: s.id,
      metric: s.metric,
      point,
      quantiles: {
        "0.1": lower,
        "0.5": point,
        "0.9": upper,
      },
    };
  });

  return {
    ok: true,
    provider: "local_fallback",
    model: "trailing_growth_fallback",
    forecasts,
  };
}
