function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function computeGrowthRates(values) {
  const rates = [];
  let outlierCount = 0;
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    if (prev > 0) {
      const raw = (values[i] - prev) / prev;
      const capped = Math.max(-0.5, Math.min(1.0, raw));
      if (Math.abs(raw - capped) > 1e-10) outlierCount++;
      rates.push(capped);
    }
  }
  return { rates, outlierCount };
}

function getCalendarMonth(dateStr) {
  return parseInt(dateStr.slice(5, 7), 10);
}

function computeSeasonalityFactors(values, dates) {
  if (!values.length) return {};
  const overallAvg = values.reduce((s, v) => s + v, 0) / values.length;
  if (overallAvg === 0) return {};

  const monthSums = {};
  const monthCounts = {};
  values.forEach((v, i) => {
    const m = getCalendarMonth(dates[i]);
    monthSums[m] = (monthSums[m] || 0) + v;
    monthCounts[m] = (monthCounts[m] || 0) + 1;
  });

  const factors = {};
  for (let m = 1; m <= 12; m++) {
    factors[m] = monthCounts[m] ? (monthSums[m] / monthCounts[m]) / overallAvg : 1.0;
  }
  return factors;
}

function detectMissingMonths(dates) {
  if (dates.length < 2) return 0;
  const sorted = [...dates].sort();
  let missing = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevYear = parseInt(sorted[i - 1].slice(0, 4), 10);
    const prevMonth = parseInt(sorted[i - 1].slice(5, 7), 10);
    const curYear = parseInt(sorted[i].slice(0, 4), 10);
    const curMonth = parseInt(sorted[i].slice(5, 7), 10);
    const diff = (curYear - prevYear) * 12 + (curMonth - prevMonth);
    if (diff > 1) missing += diff - 1;
  }
  return missing;
}

function computeTrendStability(growthRates) {
  if (growthRates.length < 3) return 0.5;
  const vol = stddev(growthRates);
  return Math.max(0, Math.min(1, 1 - vol * 5));
}

export function extractForecastFeatures(values, dates) {
  const N = values.length;
  if (!N) return null;

  const latestValue = values[N - 1];
  const { rates: growthRates, outlierCount } = computeGrowthRates(values);
  const missingMonthCount = detectMissingMonths(dates);

  const trailing3Growth = growthRates.length >= 3
    ? median(growthRates.slice(-3))
    : growthRates.length ? median(growthRates) : 0;

  const trailing6Growth = growthRates.length >= 6
    ? median(growthRates.slice(-6))
    : null;

  const medianGrowth = growthRates.length ? median(growthRates) : 0;
  const volatility = stddev(growthRates);
  const seasonalityAvailable = N >= 12;
  const seasonalityFactors = seasonalityAvailable
    ? computeSeasonalityFactors(values, dates)
    : null;
  const trendStability = computeTrendStability(growthRates);

  return {
    latestValue,
    historyMonths: N,
    missingMonthCount,
    trailing3Growth,
    trailing6Growth,
    medianGrowth,
    volatility,
    seasonalityAvailable,
    seasonalityFactors,
    outlierCount,
    trendStability,
  };
}

export { median, stddev, computeGrowthRates };
