import { buildCanonicalBenchmarkPayload } from "../framework/core/buildCanonicalBenchmarkPayload.js";

const SNAPSHOT_URL = "/data/benchmark-data.json";
const VITE_ENV = import.meta.env || {};
const RAW_LIVE_API_URL =
  VITE_ENV.VITE_BENCHMARK_API_URL || VITE_ENV.VITE_CI_API_URL || "";

export const DATA_SOURCE_TYPES = {
  LOCAL_SNAPSHOT: "local-snapshot",
  LIVE_API: "live-api",
  SNAPSHOT_FALLBACK: "snapshot-fallback",
};

const DATA_SOURCE_LABELS = {
  [DATA_SOURCE_TYPES.LOCAL_SNAPSHOT]: "Sample data",
  [DATA_SOURCE_TYPES.LIVE_API]: "Live API",
  [DATA_SOURCE_TYPES.SNAPSHOT_FALLBACK]: "Snapshot fallback",
};

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
  return Boolean(VITE_ENV.DEV);
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

async function normalizePayload(json, sourceLabel) {
  // Array shorthand: bare array is treated as source_monthly rows.
  if (Array.isArray(json)) {
    json = { ok: true, data: { source_monthly: json } };
  }

  if (json?.ok !== true) {
    const message = json?.error?.message || json?.error || `${sourceLabel} returned ok=false.`;
    throw new Error(String(message));
  }

  if (!json.data || typeof json.data !== "object") {
    json.data = {};
  }

  // Delegate all pipeline work to the canonical builder.
  try {
    return await buildCanonicalBenchmarkPayload(json);
  } catch (err) {
    throw new Error(`${sourceLabel} pipeline failed: ${err.message}`);
  }
}

export function createDataSourceMetadata(type, details = {}) {
  const normalizedType = DATA_SOURCE_LABELS[type] ? type : DATA_SOURCE_TYPES.LOCAL_SNAPSHOT;
  return {
    type: normalizedType,
    label: DATA_SOURCE_LABELS[normalizedType],
    ...details,
  };
}

function withDataSourceMetadata(json, metadata) {
  return {
    ...json,
    meta: {
      ...(json.meta || {}),
      data_source: metadata,
    },
  };
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

  return await normalizePayload(json, sourceLabel);
}

export async function loadBenchmarkData() {
  const liveApiUrl = buildLiveApiUrl(RAW_LIVE_API_URL);
  let liveApiError = "";

  if (liveApiUrl) {
    try {
      logDataSource("info", "Trying live API first.", liveApiUrl);
      const json = await fetchBenchmarkJson(liveApiUrl, "Live benchmark API");
      logDataSource("info", "Loaded live API successfully.");
      return withDataSourceMetadata(
        json,
        createDataSourceMetadata(DATA_SOURCE_TYPES.LIVE_API),
      );
    } catch (error) {
      liveApiError = error?.message || "Unknown live API error.";
      logDataSource(
        "warn",
        "Live API failed; falling back to local snapshot.",
        liveApiError,
      );
    }
  } else {
    logDataSource("info", "No live API URL configured; using local snapshot.");
  }

  try {
    const json = await fetchBenchmarkJson(SNAPSHOT_URL, "Local benchmark snapshot");
    logDataSource("info", "Loaded local snapshot successfully.");
    const sourceType = liveApiUrl
      ? DATA_SOURCE_TYPES.SNAPSHOT_FALLBACK
      : DATA_SOURCE_TYPES.LOCAL_SNAPSHOT;
    const details = liveApiError ? { fallbackReason: liveApiError } : {};
    return withDataSourceMetadata(json, createDataSourceMetadata(sourceType, details));
  } catch (error) {
    const snapshotError = error?.message || "Unknown snapshot error.";
    if (liveApiError) {
      throw new Error(
        `Live benchmark API failed (${liveApiError}). Local snapshot fallback also failed (${snapshotError}).`,
      );
    }
    throw new Error(`Local benchmark snapshot failed (${snapshotError}).`);
  }
}

export const dataSource = {
  type: RAW_LIVE_API_URL ? "live-api-with-snapshot-fallback" : "local-snapshot",
  liveUrl: buildLiveApiUrl(RAW_LIVE_API_URL),
  snapshotUrl: SNAPSHOT_URL,
  load: loadBenchmarkData,
};
