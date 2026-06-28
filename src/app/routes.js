import { benchmarkConfig } from "../config/benchmarkConfig.js";
import { getProfileHash as buildProfileHash } from "../viewModels/profileViewModel.js";

const HOME_HASH = benchmarkConfig.routes.home;
const FORECAST_HASH = benchmarkConfig.routes.forecast;
const BATTLE_ARENA_HASH = benchmarkConfig.routes.battleArena;
const PROFILE_HASH_PREFIX = benchmarkConfig.routes.profilePrefix;

export function parseRouteFromHash(hash = "") {
  const normalizedHash = String(hash || "").trim();

  if (
    !normalizedHash ||
    normalizedHash === "#" ||
    normalizedHash === "#/" ||
    normalizedHash === HOME_HASH
  ) {
    return { view: "home", companyId: "" };
  }

  if (normalizedHash === FORECAST_HASH) {
    return { view: "forecast", companyId: "" };
  }

  if (normalizedHash === BATTLE_ARENA_HASH) {
    return { view: "battle", companyId: "" };
  }

  if (normalizedHash.startsWith(PROFILE_HASH_PREFIX)) {
    const rawCompanyId = normalizedHash
      .slice(PROFILE_HASH_PREFIX.length)
      .split("?")[0];

    try {
      return { view: "profile", companyId: decodeURIComponent(rawCompanyId) };
    } catch {
      return { view: "profile", companyId: rawCompanyId };
    }
  }

  return { view: "home", companyId: "" };
}

export function getCurrentRoute() {
  if (typeof window === "undefined") return { view: "home", companyId: "" };

  return parseRouteFromHash(window.location.hash);
}

export function getProfileHashFromId(companyId) {
  return buildProfileHash(PROFILE_HASH_PREFIX, companyId);
}

export function navigateToHash(hash) {
  if (typeof window === "undefined") return;

  if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
}

export { HOME_HASH, FORECAST_HASH, BATTLE_ARENA_HASH, PROFILE_HASH_PREFIX };
