const VITE_ENV = (() => {
  try {
    return import.meta.env || {};
  } catch {
    return {};
  }
})();

export async function timesfmProvider({ series, horizonMonths }, { apiUrl, fetchFn } = {}) {
  const url = apiUrl || VITE_ENV.VITE_TIMESFM_API_URL || "";
  const fetcher = fetchFn || (typeof fetch !== "undefined" ? fetch : null);

  if (!url) {
    return {
      ok: false,
      provider: "timesfm",
      error: "VITE_TIMESFM_API_URL is not configured.",
    };
  }

  if (!fetcher) {
    return {
      ok: false,
      provider: "timesfm",
      error: "fetch is not available in this environment.",
    };
  }

  const requestBody = {
    horizonMonths,
    series: series.map((s) => ({
      id: s.id,
      metric: s.metric,
      frequency: "monthly",
      values: s.values,
    })),
  };

  let response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    return {
      ok: false,
      provider: "timesfm",
      error: `TimesFM request failed: ${err.message || "network error"}`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      provider: "timesfm",
      error: `TimesFM returned HTTP ${response.status}`,
    };
  }

  let json;
  try {
    json = await response.json();
  } catch {
    return {
      ok: false,
      provider: "timesfm",
      error: "TimesFM returned invalid JSON",
    };
  }

  return json;
}
