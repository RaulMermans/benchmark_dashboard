import { buildBenchmarkDataset } from "../core/buildBenchmarkDataset.js";
import { validateBenchmarkPayload } from "../schema/validateBenchmarkPayload.js";

export function adaptJsonPayload(payload, config = {}) {
  const validation = validateBenchmarkPayload(payload);
  if (!validation.valid) {
    return {
      ok: false,
      validation,
      data: { interface: [], events: [], dictionary: [] },
      meta: payload?.meta ?? {},
    };
  }

  return buildBenchmarkDataset(payload, config);
}

export async function fetchJsonBenchmarkPayload(url, config = {}) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Benchmark JSON request failed with HTTP ${response.status}.`);
  const payload = await response.json();
  return adaptJsonPayload(payload, config);
}
