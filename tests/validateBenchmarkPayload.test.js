import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { adaptSimpleMonthlyRows } from "../src/framework/adapters/simpleMonthlyAdapter.js";
import { validateBenchmarkPayload } from "../src/framework/schema/validateBenchmarkPayload.js";
import { expect } from "./helpers/expect.js";
import { simpleMonthlyRows } from "./fixtures/simpleRows.js";

describe("validateBenchmarkPayload", () => {
  it("accepts the current public mock JSON", () => {
    const payload = JSON.parse(
      readFileSync(join(process.cwd(), "public", "data", "benchmark-data.json"), "utf8"),
    );
    const result = validateBenchmarkPayload(payload);

    expect(result.valid).toBe(true);
    expect(result.summary.rowCount).toBeGreaterThan(0);
    expect(result.summary.companyCount).toBeGreaterThan(0);
    expect(result.summary.markets).toContain("Demo Market");
  });

  it("accepts simple monthly adapter output with enriched fields", () => {
    const payload = adaptSimpleMonthlyRows(simpleMonthlyRows);
    const result = validateBenchmarkPayload(payload);
    const brandA2026 = payload.data.interface.find(
      (row) => row.company_id === "brand_a" && row.date === "2026-01-01",
    );

    expect(result.valid).toBe(true);
    expect(brandA2026.market_share_revenue).toBeCloseTo(0.625, 5);
    expect(brandA2026.market_share_visits).toBeCloseTo(0.521739, 5);
    expect(brandA2026.revenue_yoy_growth).toBeCloseTo(0.25, 5);
    expect(brandA2026.rank_revenue).toBe(1);
    expect(brandA2026.revenue_per_visit).toBeCloseTo(2.0833, 4);
    expect(brandA2026.revenue_share_vs_visit_share).toBeCloseTo(0.103261, 5);
  });
});
