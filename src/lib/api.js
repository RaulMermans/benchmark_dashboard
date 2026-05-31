const SNAPSHOT_URL = "/data/benchmark-data.json";
const RAW_LIVE_API_URL =
  import.meta.env.VITE_BENCHMARK_API_URL || import.meta.env.VITE_CI_API_URL || "";

const LIVE_API_DEFAULT_PARAMS = {
  period_type: "monthly",
  limit: "50000",
  includeBenchmark: "true",
  includeForecasts: "true",
  mergeForecastsIntoInterface: "true",
  includeInsights: "true",
  includeDictionary: "false",
};

function isDevelopment() {
  return Boolean(import.meta.env.DEV);
}

function logDataSource(level, message, detail) {
  if (!isDevelopment()) return;

  const logger = level === "warn" ? console.warn : console.info;
  if (detail) {
    logger(`[benchmark-data] ${message}`, detail);
    return;
  }

  logger(`[benchmark-data] ${message}`);
}

function buildLiveApiUrl(rawUrl = "") {
  const trimmedUrl = String(rawUrl || "").trim();
  if (!trimmedUrl) return "";

  try {
    const baseUrl =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://localhost";
    const url = new URL(trimmedUrl, baseUrl);

    Object.entries(LIVE_API_DEFAULT_PARAMS).forEach(([key, value]) => {
      if (!url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    });

    if (/^https?:\/\//i.test(trimmedUrl)) {
      return url.toString();
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return trimmedUrl;
  }
}

function normalizePayload(json, sourceLabel) {
  if (json?.ok !== true) {
    const message = json?.error?.message || json?.error || `${sourceLabel} returned ok=false.`;
    throw new Error(String(message));
  }

  if (!json.data || typeof json.data !== "object") {
    json.data = {};
  }

  if (!Array.isArray(json.data.interface)) {
    throw new Error(`${sourceLabel} is missing data.interface as an array.`);
  }

  if (!Array.isArray(json.data.events)) {
    json.data.events = [];
  }

  if (!Array.isArray(json.data.dictionary)) {
    json.data.dictionary = [];
  }

  if (!Array.isArray(json.data.forecasts)) {
    json.data.forecasts = [];
  }

  if (!Array.isArray(json.data.insights)) {
    json.data.insights = [];
  }

  return json;
}

async function fetchBenchmarkJson(url, sourceLabel) {
  let response;

  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    throw new Error(`${sourceLabel} could not be reached: ${error?.message || "network error"}.`);
  }

  if (!response.ok) {
    throw new Error(`${sourceLabel} request failed with HTTP ${response.status}.`);
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(`${sourceLabel} did not return valid JSON.`);
  }

  return normalizePayload(json, sourceLabel);
}

export async function loadBenchmarkData() {
  const liveApiUrl = buildLiveApiUrl(RAW_LIVE_API_URL);

  if (liveApiUrl) {
    try {
      logDataSource("info", "Trying live API first.", liveApiUrl);
      const json = await fetchBenchmarkJson(liveApiUrl, "Live benchmark API");
      logDataSource("info", "Loaded live API successfully.");
      return json;
    } catch (error) {
      logDataSource(
        "warn",
        "Live API failed; falling back to local snapshot.",
        error?.message || error,
      );
    }
  } else {
    logDataSource("info", "No live API URL configured; using local snapshot.");
  }

  try {
    const json = await fetchBenchmarkJson(SNAPSHOT_URL, "Local benchmark snapshot");
    logDataSource("info", "Loaded local snapshot successfully.");
    return json;
  } catch (error) {
    throw new Error(error?.message || "Could not load benchmark data.");
  }
}

export const dataSource = {
  type: RAW_LIVE_API_URL ? "live-api-with-snapshot-fallback" : "local-snapshot",
  liveUrl: buildLiveApiUrl(RAW_LIVE_API_URL),
  snapshotUrl: SNAPSHOT_URL,
  load: loadBenchmarkData,
};
