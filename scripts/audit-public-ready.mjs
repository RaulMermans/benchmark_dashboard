import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

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
const credentialPatterns = [
  /\b(api[_-]?key|apikey|token|password|secret)\b\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{16,}/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9_]{30,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
];
// Directories/files to skip silently — expected artifacts, not violations.
const skipSilently = [".git", "node_modules", "dist"];
// Directories/files whose presence is a violation (proprietary tooling, secrets).
const forbiddenPaths = [".env.local", ".codex", ".tools"];
const skipExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".svg", ".lock"]);
const findings = [];

function normalizePath(rel) {
  return rel.split(path.sep).join("/");
}

function matchesPathList(rel, list) {
  const normalized = normalizePath(rel);
  return list.some((part) => normalized === part || normalized.startsWith(`${part}/`) || normalized.includes(`/${part}/`));
}

function getPublicFiles() {
  try {
    return execSync("rg --files -g '!node_modules' -g '!dist' -g '!.git'", {
      cwd: root,
      encoding: "utf8",
      timeout: 5000,
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

for (const forbiddenPath of forbiddenPaths) {
  if (fs.existsSync(path.join(root, forbiddenPath))) {
    findings.push(`Forbidden path present locally: ${forbiddenPath}`);
  }
}

for (const rel of getPublicFiles()) {
  const normalized = normalizePath(rel);
  if (normalized === "scripts/audit-public-ready.mjs") continue;
  if (matchesPathList(rel, skipSilently)) continue;
  if (matchesPathList(rel, forbiddenPaths) || normalized.toLowerCase().endsWith(".zip")) {
    findings.push(`Forbidden tracked file present: ${normalized}`);
    continue;
  }
  if (skipExtensions.has(path.extname(normalized).toLowerCase())) continue;

  let text = "";
  try { text = fs.readFileSync(path.join(root, rel), "utf8"); } catch { continue; }
  for (const term of forbiddenTerms) {
    if (text.toLowerCase().includes(term.toLowerCase())) findings.push(`Forbidden reference in ${normalized}`);
  }
  for (const pattern of credentialPatterns) {
    if (pattern.test(text)) findings.push(`Credential-like value in ${normalized}`);
  }
}
if (findings.length) {
  console.error("Public-readiness audit failed:");
  findings.slice(0, 100).forEach((finding) => console.error(`- ${finding}`));
  if (findings.length > 100) console.error(`... ${findings.length - 100} more findings`);
  process.exit(1);
}
console.log("Public-readiness audit passed.");
