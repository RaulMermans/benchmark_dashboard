import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const root=process.cwd();
const skipDirs=new Set([".git","node_modules","dist",".tools",".codex"]);
const skipFiles=new Set(["scripts/audit-public-ready.mjs"]);
const textExtensions=[".js",".jsx",".json",".md",".css",".html",".env",".example",".txt",".svg"];
const decode=v=>Buffer.from(v,"base64").toString("utf8");
const forbiddenTerms=["cHJpbW9y","ZHJ1bmk=","c2VwaG9yYQ==","ZG91Z2xhcw==","bm90aW5v","YXJlbmFs","bWFxdWlsbGFsaWE=","cGVyZnVtZXNjbHVi","cGFjb3BlcmZ1bWVyaWFz","c2ltaWxhcndlYg==","ZWNkYg==","MDdfaW50ZXJmYWNlX3JlYWR5","MDVfbm90ZXNfZXZlbnRz","MDhfbWV0cmljX2RpY3Rpb25hcnk=","c2NyaXB0Lmdvb2dsZS5jb20=","VklURV9DSV9BUElfVVJM"].map(decode);
const forbiddenPaths=[".env.local",".tools"];
function isTextFile(path){const lower=path.toLowerCase(); return textExtensions.some(ext=>lower.endsWith(ext));}
function walk(dir,out=[]){for(const entry of readdirSync(dir)){if(skipDirs.has(entry))continue; const full=join(dir,entry); const rel=relative(root,full).replaceAll("\\","/"); const stats=statSync(full); if(stats.isDirectory())walk(full,out); else if(!skipFiles.has(rel)&&isTextFile(rel))out.push(full);} return out;}
const errors=[];
for(const path of forbiddenPaths)if(existsSync(join(root,path)))errors.push(`Forbidden path present: ${path}`);
for(const file of walk(root)){const rel=relative(root,file).replaceAll("\\","/"); const content=readFileSync(file,"utf8").toLowerCase(); for(const term of forbiddenTerms){if(content.includes(term.toLowerCase())){errors.push(`Forbidden term detected in ${rel}`); break;}}}
if(errors.length){console.error("Public-readiness audit failed:"); for(const e of errors)console.error(`- ${e}`); process.exit(1);} console.log("Public-readiness audit passed.");
