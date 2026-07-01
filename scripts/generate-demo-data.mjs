import fs from "node:fs";
import path from "node:path";

const OUTPUT_PATH = path.resolve("public/data/benchmark-data.json");
const MARKET = "Demo Market";

const companies = [
  {
    id: "focus",
    name: "Focus Brand",
    type: "own",
    revenue: 420000,
    visits: 310000,
    revenueGrowth: 0.135,
    visitsGrowth: 0.105,
    efficiencyTrend: 0.018,
    yearAdjust: { 2022: 1.08, 2023: 0.98, 2024: 1.08, 2025: 1.11 },
    visitYearAdjust: { 2022: 1.06, 2023: 1.01, 2024: 1.05, 2025: 1.06 },
  },
  {
    id: "peer_a",
    name: "Apex Digital",
    type: "competitor",
    revenue: 760000,
    visits: 510000,
    revenueGrowth: 0.082,
    visitsGrowth: 0.072,
    efficiencyTrend: -0.004,
    yearAdjust: { 2022: 1.06, 2023: 0.99, 2024: 1.03, 2025: 1.025 },
    visitYearAdjust: { 2022: 1.055, 2023: 1.015, 2024: 1.03, 2025: 1.02 },
  },
  {
    id: "peer_b",
    name: "Crest Commerce",
    type: "competitor",
    revenue: 540000,
    visits: 390000,
    revenueGrowth: 0.072,
    visitsGrowth: 0.058,
    efficiencyTrend: 0.006,
    yearAdjust: { 2022: 1.045, 2023: 0.965, 2024: 1.035, 2025: 1.02 },
    visitYearAdjust: { 2022: 1.04, 2023: 0.985, 2024: 1.025, 2025: 1.015 },
  },
  {
    id: "peer_c",
    name: "Nova Retail",
    type: "competitor",
    revenue: 300000,
    visits: 260000,
    revenueGrowth: 0.205,
    visitsGrowth: 0.178,
    efficiencyTrend: 0.013,
    yearAdjust: { 2022: 1.14, 2023: 1.01, 2024: 1.12, 2025: 1.16 },
    visitYearAdjust: { 2022: 1.13, 2023: 1.035, 2024: 1.12, 2025: 1.14 },
  },
  {
    id: "peer_d",
    name: "Orbit Market",
    type: "competitor",
    revenue: 470000,
    visits: 470000,
    revenueGrowth: 0.055,
    visitsGrowth: 0.095,
    efficiencyTrend: -0.018,
    yearAdjust: { 2022: 1.04, 2023: 0.94, 2024: 1.015, 2025: 0.99 },
    visitYearAdjust: { 2022: 1.08, 2023: 1.065, 2024: 1.04, 2025: 1.02 },
  },
  {
    id: "peer_e",
    name: "Luma Store",
    type: "competitor",
    revenue: 260000,
    visits: 165000,
    revenueGrowth: 0.115,
    visitsGrowth: 0.065,
    efficiencyTrend: 0.031,
    yearAdjust: { 2022: 1.08, 2023: 1.015, 2024: 1.09, 2025: 1.075 },
    visitYearAdjust: { 2022: 1.045, 2023: 1.0, 2024: 1.035, 2025: 1.025 },
  },
  {
    id: "peer_f",
    name: "Harbor Direct",
    type: "competitor",
    revenue: 610000,
    visits: 435000,
    revenueGrowth: 0.038,
    visitsGrowth: 0.026,
    efficiencyTrend: 0.002,
    yearAdjust: { 2022: 1.035, 2023: 0.985, 2024: 1.025, 2025: 1.005 },
    visitYearAdjust: { 2022: 1.025, 2023: 0.995, 2024: 1.02, 2025: 1.0 },
  },
  {
    id: "peer_g",
    name: "Cascade Goods",
    type: "competitor",
    revenue: 190000,
    visits: 150000,
    revenueGrowth: 0.128,
    visitsGrowth: 0.102,
    efficiencyTrend: 0.014,
    yearAdjust: { 2022: 1.075, 2023: 1.0, 2024: 1.055, 2025: 1.065 },
    visitYearAdjust: { 2022: 1.065, 2023: 1.01, 2024: 1.045, 2025: 1.05 },
  },
];

const revenueSeasonality = {
  1: 0.9,
  2: 0.96,
  3: 1.0,
  4: 1.01,
  5: 1.03,
  6: 1.02,
  7: 1.04,
  8: 1.035,
  9: 1.0,
  10: 1.04,
  11: 1.13,
  12: 1.24,
};

const visitsSeasonality = {
  1: 0.94,
  2: 0.97,
  3: 1.0,
  4: 1.01,
  5: 1.02,
  6: 1.04,
  7: 1.065,
  8: 1.055,
  9: 1.015,
  10: 1.02,
  11: 1.065,
  12: 1.09,
};

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return () => {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise(key, amplitude) {
  const random = mulberry32(hashString(key))();
  return 1 + (random * 2 - 1) * amplitude;
}

function monthDate(year, month) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function buildRows() {
  const rows = [];

  for (const company of companies) {
    for (let year = 2021; year <= 2025; year++) {
      for (let month = 1; month <= 12; month++) {
        const monthIndex = (year - 2021) * 12 + (month - 1);
        const date = monthDate(year, month);
        const revenueTrend = (1 + company.revenueGrowth) ** (monthIndex / 12);
        const visitsTrend = (1 + company.visitsGrowth) ** (monthIndex / 12);
        const efficiency = (1 + company.efficiencyTrend) ** (monthIndex / 12);
        const revenueRegime = company.yearAdjust[year] ?? 1;
        const visitRegime = company.visitYearAdjust[year] ?? 1;
        const campaignLift = getEventLift(company.id, year, month);

        const revenue = Math.round(
          company.revenue *
            revenueTrend *
            revenueRegime *
            efficiency *
            revenueSeasonality[month] *
            campaignLift.revenue *
            noise(`${company.id}:${date}:revenue`, 0.022),
        );
        const visits = Math.round(
          company.visits *
            visitsTrend *
            visitRegime *
            visitsSeasonality[month] *
            campaignLift.visits *
            noise(`${company.id}:${date}:visits`, 0.018),
        );

        rows.push({
          date,
          company_id: company.id,
          display_name: company.name,
          market: MARKET,
          type: company.type,
          revenue: Math.max(1000, revenue),
          visits: Math.max(1000, visits),
          active: true,
        });
      }
    }
  }

  return rows;
}

function getEventLift(companyId, year, month) {
  const key = `${companyId}:${year}-${String(month).padStart(2, "0")}`;
  const lifts = {
    "focus:2021-06": { revenue: 1.025, visits: 1.015 },
    "peer_c:2022-03": { revenue: 1.018, visits: 1.035 },
    "peer_a:2022-11": { revenue: 1.035, visits: 1.018 },
    "peer_d:2023-04": { revenue: 0.985, visits: 1.045 },
    "peer_b:2023-09": { revenue: 0.965, visits: 0.98 },
    "focus:2024-02": { revenue: 1.035, visits: 1.006 },
    "peer_e:2024-06": { revenue: 1.032, visits: 0.997 },
    "peer_f:2024-11": { revenue: 1.026, visits: 1.014 },
    "peer_c:2025-03": { revenue: 1.028, visits: 1.032 },
    "focus:2025-09": { revenue: 1.022, visits: 1.018 },
  };

  return lifts[key] ?? { revenue: 1, visits: 1 };
}

const events = [
  {
    date: "2021-06-01",
    company_id: "focus",
    event_name: "Retention campaign",
    event_type: "marketing",
    description: "Focus Brand launches a synthetic retention campaign.",
  },
  {
    date: "2021-10-01",
    company_id: "peer_g",
    event_name: "Assortment refresh",
    event_type: "product",
    description: "Cascade Goods refreshes its public demo catalogue mix.",
  },
  {
    date: "2022-03-01",
    company_id: "peer_c",
    event_name: "Acquisition expansion",
    event_type: "marketing",
    description: "Nova Retail expands synthetic acquisition spend.",
  },
  {
    date: "2022-07-01",
    company_id: "peer_e",
    event_name: "Niche channel push",
    event_type: "marketing",
    description: "Luma Store tests a focused demo-channel campaign.",
  },
  {
    date: "2022-11-01",
    company_id: "peer_a",
    event_name: "Holiday campaign",
    event_type: "marketing",
    description: "Apex Digital runs a synthetic holiday campaign.",
  },
  {
    date: "2023-04-01",
    company_id: "peer_d",
    event_name: "Traffic spike",
    event_type: "traffic",
    description: "Orbit Market sees higher demo traffic with weaker monetization.",
  },
  {
    date: "2023-09-01",
    company_id: "peer_b",
    event_name: "Logistics issue",
    event_type: "operations",
    description: "Crest Commerce has a synthetic logistics issue.",
  },
  {
    date: "2024-02-01",
    company_id: "focus",
    event_name: "Checkout optimization",
    event_type: "product",
    description: "Focus Brand improves its demo checkout flow.",
  },
  {
    date: "2024-06-01",
    company_id: "peer_e",
    event_name: "Pricing refresh",
    event_type: "pricing",
    description: "Luma Store refreshes synthetic pricing.",
  },
  {
    date: "2024-11-01",
    company_id: "peer_f",
    event_name: "Seasonal campaign",
    event_type: "marketing",
    description: "Harbor Direct launches a synthetic seasonal campaign.",
  },
  {
    date: "2025-03-01",
    company_id: "peer_c",
    event_name: "Market expansion",
    event_type: "expansion",
    description: "Nova Retail expands within the synthetic demo market.",
  },
  {
    date: "2025-09-01",
    company_id: "focus",
    event_name: "Loyalty programme",
    event_type: "product",
    description: "Focus Brand launches a synthetic loyalty programme.",
  },
];

const payload = {
  ok: true,
  meta: {
    dataset_name: "Demo Benchmark Dataset",
    currency: "EUR",
    source_type: "raw_monthly_observations",
    data_policy: "Synthetic demo data only. No real company or client data is included.",
  },
  data: {
    source_monthly: buildRows(),
    events,
  },
};

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Generated ${payload.data.source_monthly.length} source_monthly rows at ${OUTPUT_PATH}`);
