import { describe, it } from "node:test";
import { normalizeRows } from "../src/framework/core/normalizeRows.js";
import { expect } from "./helpers/expect.js";
import { simpleMonthlyRows } from "./fixtures/simpleRows.js";

describe("normalizeRows", () => {
  it("keeps required benchmark fields and does not mutate input rows", () => {
    const source = simpleMonthlyRows.slice(0, 1);
    const normalized = normalizeRows(source);

    expect(Object.hasOwn(source[0], "period_type")).toBe(false);
    expect(normalized[0]).toMatchObject({
      date: "2025-01-01",
      period_type: "monthly",
      company_id: "brand_a",
      display_name: "Brand A",
      type: "competitor",
      market: "Demo Market",
      revenue: 100,
      visits: 50,
      data_type: "estimated",
    });
  });
});
