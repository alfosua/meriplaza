#!/usr/bin/env node
// Cloudflare edge deployment preflight. Keeps the deploy target honest without
// requiring remote Cloudflare credentials.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fail = (msg) => {
  console.error(`check-edge: ${msg}`);
  process.exit(1);
};
const read = (path) => readFileSync(join(root, path), "utf8");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: false });
  if (r.status !== 0) fail(`${cmd} ${args.join(" ")} failed`);
}

function stripJsonc(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");
}

function checkWrangler() {
  const cfg = JSON.parse(stripJsonc(read("wrangler.jsonc")));
  if (cfg.name !== "salesfactory-edge") fail("wrangler name must be salesfactory-edge");
  if (cfg.main !== "src/index.ts") fail("wrangler main must be src/index.ts");
  if (!cfg.compatibility_date) fail("wrangler compatibility_date is required");
  const d1 = cfg.d1_databases?.find((x) => x.binding === "DB");
  if (!d1?.database_name || !d1?.database_id || d1.migrations_dir !== "migrations") fail("D1 DB binding is incomplete");
  const kv = cfg.kv_namespaces?.find((x) => x.binding === "CACHE");
  if (!kv?.id) fail("KV CACHE binding is incomplete");
}

function checkMigrations() {
  const migrations = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const required of ["0001_init.sql", "0003_accounts.sql", "0005_quickpago.sql", "0006_user_profiles.sql"]) {
    if (!migrations.includes(required)) fail(`missing migration ${required}`);
  }
  const userProfiles = read("migrations/0006_user_profiles.sql");
  if (!userProfiles.includes("CREATE TABLE IF NOT EXISTS user_profiles")) fail("user profile migration is incomplete");
}

function checkSeed() {
  const seed = read("scripts/seed-v3.mjs");
  run("node", ["--check", "scripts/seed-v3.mjs"]);
  for (const store of ["Farmatodo", "Locatel", "EPA", "Beco", "Traki", "Mundo Repuesto"]) {
    if (!seed.includes(store)) fail(`seed-v3 is missing ${store}`);
  }
  if (!seed.includes("EXTRA_BULK") || !seed.includes("generatedCatalog")) fail("seed-v3 bulk catalog generation is missing");
  const storesBlock = seed.match(/const STORES = \[([\s\S]*?)\];/)?.[1] ?? "";
  const storeCount = (storesBlock.match(/handle:/g) ?? []).length;
  if (storeCount < 14) fail(`seed-v3 expected at least 14 stores, found ${storeCount}`);

  const baseProducts = (seed.match(/const PRODUCTS = \[([\s\S]*?)\];\n\nconst REVIEWS/)?.[1].match(/\bkey:/g) ?? []).length;
  const trakiProducts = Number(seed.match(/const TRAKI_BULK = trakiProducts\((\d+)\)/)?.[1] ?? 0);
  const generatedProducts = [...seed.matchAll(/generatedCatalog\([\s\S]*?,\s*(\d+),\s*\{/g)]
    .reduce((sum, m) => sum + Number(m[1]), 0);
  const productCount = baseProducts + trakiProducts + generatedProducts;
  if (productCount < 600) fail(`seed-v3 expected at least 600 products, found ${productCount}`);
}

function checkTests() {
  for (const testFile of ["test/checkout.test.ts", "test/fulfillment.test.ts", "test/profile.test.ts", "test/quickpago.test.ts"]) {
    if (!existsSync(join(root, testFile))) fail(`missing ${testFile}`);
  }
}

checkWrangler();
checkMigrations();
checkSeed();
checkTests();
run("npm", ["run", "typecheck"]);
run("npm", ["test"]);
console.log("check-edge: ok");
