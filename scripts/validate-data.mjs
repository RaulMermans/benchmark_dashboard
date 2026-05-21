import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateBenchmarkPayload } from "../src/framework/schema/validateBenchmarkPayload.js";

const dataPath = join(process.cwd(), "public", "data", "benchmark-data.json");

function printIssues(label, issues) {
  if (!issues.length) return;
  console.log(`\n${label}:`);
  issues.forEach((issue) => {
    const path = issue.path ? ` (${issue.path})` : "";
    console.log(`- [${issue.code}] ${issue.message}${path}`);
  });
}

let payload;

try {
  payload = JSON.parse(readFileSync(dataPath, "utf8"));
} catch (error) {
  console.error(`Could not read ${dataPath}: ${error.message}`);
  process.exit(1);
}

const result = validateBenchmarkPayload(payload);
const { summary } = result;

console.log("Benchmark data validation report");
console.log(`- File: ${dataPath}`);
console.log(`- Valid: ${result.valid ? "yes" : "no"}`);
console.log(`- Rows: ${summary.rowCount}`);
console.log(`- Companies: ${summary.companyCount}`);
console.log(`- Markets: ${summary.markets.join(", ") || "N/A"}`);
console.log(`- Date range: ${summary.dateRange.start || "N/A"} to ${summary.dateRange.end || "N/A"}`);
console.log(`- Forecasts: ${summary.hasForecasts ? "yes" : "no"}`);
console.log(`- Events: ${summary.hasEvents ? "yes" : "no"}`);

printIssues("Warnings", result.warnings);
printIssues("Errors", result.errors);

process.exit(result.valid ? 0 : 1);
