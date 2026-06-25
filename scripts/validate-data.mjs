import fs from "node:fs";
import path from "node:path";
import { validateBenchmarkPayload } from "../src/framework/schema/validateBenchmarkPayload.js";
import { validateSourceMonthlyRows } from "../src/framework/schema/validateSourceMonthlyRows.js";

const filePath = path.resolve("public/data/benchmark-data.json");
const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));

const isSourceMonthly = Array.isArray(payload?.data?.source_monthly);

if (isSourceMonthly) {
  console.log("Benchmark data validation (source_monthly format)");
  const result = validateSourceMonthlyRows(payload.data.source_monthly);
  console.log(`Valid: ${result.ok ? "yes" : "no"}`);
  console.log(`Rows: ${result.summary?.rowCount ?? 0}`);
  console.log(`Companies: ${result.summary?.companyCount ?? 0}`);
  console.log(`Markets: ${result.summary?.markets?.join(", ") || "none"}`);
  console.log(`Date range: ${result.summary?.dateRange?.start || "n/a"} to ${result.summary?.dateRange?.end || "n/a"}`);

  if (result.warnings.length) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
  if (!result.ok) {
    console.error("Errors:");
    result.errors.slice(0, 50).forEach((error) => console.error(`- ${error}`));
    if (result.errors.length > 50) console.error(`... ${result.errors.length - 50} more errors`);
    process.exit(1);
  }
} else {
  console.log("Benchmark data validation (data.interface legacy format)");
  const result = validateBenchmarkPayload(payload);
  console.log(`Valid: ${result.valid ? "yes" : "no"}`);
  console.log(`Rows: ${result.summary.rowCount}`);
  console.log(`Companies: ${result.summary.companyCount}`);
  console.log(`Markets: ${result.summary.markets.join(", ") || "none"}`);
  console.log(`Date range: ${result.summary.dateRange?.start || "n/a"} to ${result.summary.dateRange?.end || "n/a"}`);
  console.log(`Forecasts: ${result.summary.hasForecasts ? "yes" : "no"}`);
  console.log(`Events: ${result.summary.hasEvents ? "yes" : "no"}`);

  if (result.warnings.length) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
  if (result.errors.length) {
    console.error("Errors:");
    result.errors.slice(0, 50).forEach((error) => console.error(`- ${error}`));
    if (result.errors.length > 50) console.error(`... ${result.errors.length - 50} more errors`);
    process.exit(1);
  }
}
