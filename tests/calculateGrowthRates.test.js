import { describe, it } from "node:test";
import { calculateGrowthRates } from "../src/framework/core/calculateGrowthRates.js";
import { normalizeRows } from "../src/framework/core/normalizeRows.js";
import { expect } from "./helpers/expect.js";
import { simpleMonthlyRows } from "./fixtures/simpleRows.js";

describe("calculateGrowthRates", () => {
  it("handles missing prior periods and calculates available growth", () => {
    const rows = calculateGrowthRates(normalizeRows(simpleMonthlyRows), { preserveExisting: false });
    const first = rows.find((row) => row.company_id === "brand_a" && row.date === "2025-01-01");
    const yoy = rows.find((row) => row.company_id === "brand_a" && row.date === "2026-01-01");
    const mom = rows.find((row) => row.company_id === "brand_a" && row.date === "2026-02-01");

    expect(first.revenue_mom_growth).toBeNull();
    expect(first.revenue_yoy_growth).toBeNull();
    expect(yoy.revenue_yoy_growth).toBeCloseTo(0.25, 5);
    expect(mom.revenue_mom_growth).toBeCloseTo(0.04, 5);
  });
});
