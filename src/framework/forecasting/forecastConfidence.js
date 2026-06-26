export function scoreConfidence({ historyMonths, missingMonthCount, volatility, seasonalityAvailable, outlierCount }) {
  let score = 0.5;
  const reasons = [];

  if (historyMonths >= 18) {
    score += 0.15;
    reasons.push("18+ months of history");
  } else if (historyMonths >= 12) {
    score += 0.10;
    reasons.push("12+ months of history");
  } else if (historyMonths >= 6) {
    score += 0.05;
    reasons.push("6+ months of history");
  } else {
    score -= 0.15;
    reasons.push("Less than 6 months of history");
  }

  if (missingMonthCount > 2) {
    score -= 0.10;
    reasons.push("Missing months detected");
  } else if (missingMonthCount > 0) {
    score -= 0.05;
    reasons.push("Some months missing");
  }

  if (volatility < 0.05) {
    score += 0.10;
    reasons.push("Low volatility");
  } else if (volatility >= 0.20) {
    score -= 0.15;
    reasons.push("High volatility");
  } else if (volatility >= 0.10) {
    score -= 0.05;
    reasons.push("Moderate volatility");
  }

  if (seasonalityAvailable) {
    score += 0.10;
    reasons.push("Seasonality adjustment available");
  }

  if (outlierCount > 3) {
    score -= 0.10;
    reasons.push("Multiple outliers detected");
  } else if (outlierCount > 1) {
    score -= 0.05;
    reasons.push("Some outliers detected");
  }

  score = Math.max(0.05, Math.min(0.95, score));

  const forecast_confidence = score >= 0.70 ? "high" : score >= 0.40 ? "medium" : "low";

  return {
    forecast_confidence,
    confidence_score: Math.round(score * 100) / 100,
    confidence_reasons: reasons,
  };
}
