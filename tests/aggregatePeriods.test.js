import { describe, it } from "node:test";
import { aggregatePeriods } from "../src/framework/core/aggregatePeriods.js";
import { normalizeRows } from "../src/framework/core/normalizeRows.js";
import { expect } from "./helpers/expect.js";
import { simpleMonthlyRows } from "./fixtures/simpleRows.js";

describe("aggregatePeriods", () => {
  it("does not include forecast rows unless requested", () => {
    const rows = normalizeRows([
      ...simpleMonthlyRows.slice(0, 2),
      {
        date: "2026-01-01",
        company_id: "brand_a",
        display_name: "Brand A",
        market: "Demo Market",
        revenue: 150,
        visits: 70,
        data_type: "forecast",
        forecast_scenario: "base_case",
      },
    ]);

    const annualRows = aggregatePeriods(rows, "annual");

    expect(annualRows.some((row) => row.is_forecast)).toBe(false);
    expect(annualRows.some((row) => row.year === 2026)).toBe(false);
  });
});
