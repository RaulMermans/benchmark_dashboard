import { describe, it } from "node:test";
import { calculateRanks } from "../src/framework/core/calculateRanks.js";
import { normalizeRows } from "../src/framework/core/normalizeRows.js";
import { expect } from "./helpers/expect.js";
import { simpleMonthlyRows } from "./fixtures/simpleRows.js";

describe("calculateRanks", () => {
  it("ranks descending correctly", () => {
    const rows = calculateRanks(normalizeRows(simpleMonthlyRows.slice(0, 2)), "revenue", {
      preserveExisting: false,
    });

    expect(rows.find((row) => row.company_id === "brand_a").rank_revenue).toBe(1);
    expect(rows.find((row) => row.company_id === "brand_b").rank_revenue).toBe(2);
  });
});
