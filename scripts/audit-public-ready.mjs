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
// Directories/files to skip silently — expected artifacts, not violations.
const skipSilently = [".git", "node_modules", "dist"];
// Directories/files whose presence is a violation (proprietary tooling, secrets).
const forbiddenPaths = [".env.local", ".codex", ".tools"];
const skipExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".svg", ".lock"]);
const findings = [];

function matchesPathList(rel, list) {
  const normalized = rel.split(path.sep).join("/");
  return list.some((part) => normalized === part || normalized.startsWith(`${part}/`) || normalized.includes(`/${part}/`));
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full);
    const normalized = rel.split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (matchesPathList(rel, skipSilently)) continue;
      if (matchesPathList(rel, forbiddenPaths)) { findings.push(`Forbidden directory present: ${normalized}`); continue; }
      walk(full);
      continue;
    }
    if (normalized === "scripts/audit-public-ready.mjs") continue;
    if (matchesPathList(rel, skipSilently)) continue;
    if (matchesPathList(rel, forbiddenPaths) || entry.name.toLowerCase().endsWith(".zip")) {
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
