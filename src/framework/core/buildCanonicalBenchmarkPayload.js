import { validateSourceMonthlyRows } from "../schema/validateSourceMonthlyRows.js";
import { buildBenchmarkPayloadFromSourceMonthlyRows } from "./buildBenchmarkPayloadFromSourceMonthlyRows.js";
import { buildCoverageMetadata } from "./buildCoverageMetadata.js";
import { generateForecastRows } from "../forecasting/generateForecastRows.js";
import { enrichForecastRows } from "../forecasting/enrichForecastRows.js";

/**
 * Canonical framework pipeline.
 *
 * Accepts a raw payload (source_monthly or legacy data.interface) and returns
 * a fully enriched benchmark payload with actual derived metrics, forecast rows,
 * and coverage metadata.
 *
 * source_monthly path:
 *   validate → normalise actual rows → derived metrics → synthetic benchmarks
 *   → generate forecast rows → enrich forecast rows → merge all
 *
 * legacy data.interface path:
 *   preserve existing rows → normalise envelope
 */
export async function buildCanonicalBenchmarkPayload(inputPayload = {}, options = {}) {
  const meta = inputPayload.meta || {};
  const data = inputPayload.data || {};

  // --- source_monthly path ---
  if (Array.isArray(data.source_monthly)) {
    const sourceRows = data.source_monthly;

    const validation = validateSourceMonthlyRows(sourceRows);
    if (!validation.ok) {
      throw new Error(`source_monthly validation failed: ${validation.errors[0]}`);
    }

    // Build actual pipeline: normalise, synthetic rows, shares, efficiency, growth, indexed, ranks
    let built;
    try {
      built = buildBenchmarkPayloadFromSourceMonthlyRows(sourceRows, options);
    } catch (err) {
      throw new Error(`source_monthly pipeline failed: ${err.message}`);
    }

    // Coverage metadata from actual (non-synthetic) rows
    const actualRows = built.data.interface.filter(
      (r) => r.data_type === "actual" && r.type !== "benchmark",
    );
    const coverage = buildCoverageMetadata(actualRows);

    // Generate and enrich forecast rows — non-blocking
    let forecastRows = [];
    let forecastProvider = "none";
    try {
      const rawForecasts = await generateForecastRows(built.data.interface, options);
      if (rawForecasts.length) {
        const enriched = enrichForecastRows(rawForecasts, options);
        forecastRows = enriched;
        forecastProvider = rawForecasts[0]?.forecast_provider || "local_engine";
      }
    } catch {
      // Continue without forecasts — actual data is always returned
    }

    const allRows = [...built.data.interface, ...forecastRows];

    return {
      ok: true,
      meta: {
        ...meta,
        source_type: "raw_monthly_observations",
        generated_interface: true,
        forecast_provider: forecastProvider,
        coverage,
      },
      data: {
        source_monthly: sourceRows,
        interface: allRows,
        events: Array.isArray(data.events) ? data.events : [],
        dictionary: Array.isArray(data.dictionary) ? data.dictionary : [],
        forecasts: Array.isArray(data.forecasts) ? data.forecasts : [],
        insights: Array.isArray(data.insights) ? data.insights : [],
      },
    };
  }

  // --- legacy data.interface path ---
  if (Array.isArray(data.interface)) {
    return {
      ok: true,
      meta: {
        ...meta,
        source_type: meta.source_type || "legacy_interface",
      },
      data: {
        interface: data.interface,
        events: Array.isArray(data.events) ? data.events : [],
        dictionary: Array.isArray(data.dictionary) ? data.dictionary : [],
        forecasts: Array.isArray(data.forecasts) ? data.forecasts : [],
        insights: Array.isArray(data.insights) ? data.insights : [],
      },
    };
  }

  throw new Error(
    "Input payload must include data.source_monthly (preferred) or data.interface (legacy).",
  );
}
