import { describe, it } from "node:test";
import { calculateMarketShares } from "../src/framework/core/calculateMarketShares.js";
import { normalizeRows } from "../src/framework/core/normalizeRows.js";
import { expect } from "./helpers/expect.js";
import { simpleMonthlyRows } from "./fixtures/simpleRows.js";

describe("calculateMarketShares", () => {
  it("sums to approximately 1 per market/date", () => {
    const rows = calculateMarketShares(normalizeRows(simpleMonthlyRows.slice(0, 2)), "revenue", {
      preserveExisting: false,
    });
    const shareTotal = rows.reduce((sum, row) => sum + row.market_share_revenue, 0);

    expect(shareTotal).toBeCloseTo(1, 5);
    expect(rows[0].market_share_revenue).toBeCloseTo(0.666667, 5);
  });
});
