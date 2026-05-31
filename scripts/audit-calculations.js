import { validateBenchmarkPayload } from "../src/framework/schema/validateBenchmarkPayload.js";
import fs from "node:fs";

const payload = JSON.parse(fs.readFileSync("public/data/benchmark-data.json", "utf8"));
const result = validateBenchmarkPayload(payload);

if (!result.valid) {
  console.error(result.errors.join("\n"));
  process.exit(1);
}

console.log("Calculation/data audit passed.");
