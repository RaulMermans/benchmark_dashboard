export { buildForecastViewModel } from "../framework/index.js";

export function getForecastScenarioLabel(scenario) {
  if (scenario === "base_case") return "Base";
  if (scenario === "aggressive") return "Agresivo";
  if (scenario === "conservative") return "Conservador";
  if (scenario === "unknown") return "Sin escenario";
  return String(scenario || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getAvailableForecastScenarios(rows = [], scenarioOrder = [], isForecastRowFn, getScenarioFn) {
  const scenarios = new Set(
    rows
      .filter(isForecastRowFn)
      .map(getScenarioFn)
      .filter(Boolean),
  );
  return Array.from(scenarios).sort((a, b) => {
    const aIndex = scenarioOrder.indexOf(a);
    const bIndex = scenarioOrder.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    }
    return a.localeCompare(b);
  });
}
