// Regenerates data/universities/*.json from the Hipo world universities list (MIT licence).
//   node scripts/universities.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json";
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "universities");
mkdirSync(out, { recursive: true });

const list = await (await fetch(SRC)).json();
const byCountry = {};
for (const u of list) {
  const cc = String(u.alpha_two_code || "").toUpperCase();
  const name = String(u.name || "").replace(/\s+/g, " ").trim();
  if (/^[A-Z]{2}$/.test(cc) && name) (byCountry[cc] ||= new Set()).add(name);
}
const index = {};
for (const [cc, names] of Object.entries(byCountry).sort()) {
  const arr = [...names].sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1);
  writeFileSync(join(out, cc + ".json"), JSON.stringify(arr));
  index[cc] = arr.length;
}
writeFileSync(join(out, "index.json"), JSON.stringify(index));
console.log(`✔  ${Object.keys(index).length} countries, ${Object.values(index).reduce((a, b) => a + b, 0)} universities`);
