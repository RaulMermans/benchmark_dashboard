export function getBattleWinner(focusValue, targetValue, technicalDrawThreshold = 0.02) {
  if (focusValue === null || targetValue === null) return "unavailable";
  if (targetValue === 0) return focusValue > 0 ? "focus" : "draw";

  const relativeDiff = Math.abs(focusValue - targetValue) / Math.abs(targetValue);
  if (relativeDiff <= technicalDrawThreshold) return "draw";
  return focusValue > targetValue ? "focus" : "target";
}

export function buildBattleComparisonRow(metric, focusRow, targetRow, technicalDrawThreshold = 0.02) {
  const focusValue = focusRow?.[metric.key] ?? null;
  const targetValue = targetRow?.[metric.key] ?? null;
  const winner = getBattleWinner(focusValue, targetValue, technicalDrawThreshold);
  return {
    metricKey: metric.key,
    label: metric.label,
    focusValue,
    targetValue,
    winner,
    formatter: metric.formatter,
    deltaType: metric.deltaType,
  };
}
