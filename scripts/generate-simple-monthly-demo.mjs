import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { adaptSimpleMonthlyRows } from "../src/framework/adapters/simpleMonthlyAdapter.js";

const rows = [
  { date: "2026-01-01", company_id: "brand_a", display_name: "Brand A", market: "Demo Market", revenue: 125000, visits: 82000 },
  { date: "2026-01-01", company_id: "brand_b", display_name: "Brand B", market: "Demo Market", revenue: 98000, visits: 76000 },
  { date: "2026-02-01", company_id: "brand_a", display_name: "Brand A", market: "Demo Market", revenue: 132500, visits: 85000 },
  { date: "2026-02-01", company_id: "brand_b", display_name: "Brand B", market: "Demo Market", revenue: 101500, visits: 79000 },
];

const payload = adaptSimpleMonthlyRows(rows);
const outPath = join(process.cwd(), "public", "data", "simple-monthly-demo.json");
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${payload.data.interface.length} adapted rows to ${outPath}`);
