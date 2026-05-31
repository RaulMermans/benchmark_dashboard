import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const forbiddenTerms = [
  "Pri" + "mor",
  "Dru" + "ni",
  "Se" + "phora",
  "Dou" + "glas",
  "No" + "tino",
  "Are" + "nal",
  "Maquil" + "lalia",
  "Perfume" + "sclub",
  "Perfume" + "’s Club",
  "Paco" + " Perfumer",
  "Similar" + "web",
  "Similar" + "Web",
  "script" + ".google",
  "AK" + "fy",
  "Apps" + " Script",
];
const forbiddenPathParts = [".env.local", "node_modules", ".git", ".codex", ".tools", "dist"];
const skipExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".svg", ".lock"]);
const findings = [];

function shouldSkipPath(rel) {
  const normalized = rel.split(path.sep).join("/");
  if (normalized === "scripts/audit-public-ready.mjs") return true;
  return forbiddenPathParts.some((part) => normalized === part || normalized.startsWith(`${part}/`) || normalized.includes(`/${part}/`));
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full);
    const normalized = rel.split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (shouldSkipPath(rel)) findings.push(`Forbidden directory present: ${normalized}`);
      else walk(full);
      continue;
    }
    if (normalized === "scripts/audit-public-ready.mjs") continue;
    if (shouldSkipPath(rel) || entry.name.toLowerCase().endsWith(".zip")) {
      findings.push(`Forbidden file present: ${normalized}`);
      continue;
    }
    if (skipExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    let text = "";
    try { text = fs.readFileSync(full, "utf8"); } catch { continue; }
    for (const term of forbiddenTerms) {
      if (text.toLowerCase().includes(term.toLowerCase())) findings.push(`Forbidden reference in ${normalized}`);
    }
  }
}

walk(root);
if (findings.length) {
  console.error("Public-readiness audit failed:");
  findings.slice(0, 100).forEach((finding) => console.error(`- ${finding}`));
  if (findings.length > 100) console.error(`... ${findings.length - 100} more findings`);
  process.exit(1);
}
console.log("Public-readiness audit passed.");
