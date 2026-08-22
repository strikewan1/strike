#!/usr/bin/env node
// Pre-flight check before deploying Strike.
// Verifies environment, code quality, and build readiness without
// requiring real Supabase credentials.
//
// Usage: node scripts/preflight.mjs  (or `npm run preflight`)

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
let failures = 0;
let checksRun = 0;

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function pass(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
  checksRun++;
}

function fail(msg) {
  console.log(`${RED}✗${RESET} ${msg}`);
  failures++;
  checksRun++;
}

function warn(msg) {
  console.log(`${YELLOW}!${RESET} ${msg}`);
  checksRun++;
}

function header(msg) {
  console.log(`\n${CYAN}${BOLD}${msg}${RESET}`);
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { stdio: "pipe", cwd: root, ...opts }).toString();
  } catch (e) {
    return e.stdout?.toString() || "";
  }
}

// ──────────────────────────────────────────────
// 1. Environment
// ──────────────────────────────────────────────
header("1. Environment");

const nodeVersion = process.version;
const major = parseInt(nodeVersion.slice(1).split(".")[0], 10);
if (major >= 22) {
  pass(`Node.js ${nodeVersion} (>= 22)`);
} else {
  fail(`Node.js ${nodeVersion} — se requiere >= 22`);
}

if (existsSync(join(root, "node_modules"))) {
  pass("node_modules presente");
} else {
  fail("node_modules no encontrado — corré `npm install`");
}

if (existsSync(join(root, ".env.local"))) {
  pass(".env.local presente");
} else {
  warn(".env.local ausente — la app funcionará en preview mode");
}

// Read .env.example for reference (don't need it otherwise)
const envExample = readFileSync(join(root, ".env.example"), "utf-8");
void envExample;

// ──────────────────────────────────────────────
// 2. Env vars (production)
// ──────────────────────────────────────────────
header("2. Environment variables");

const envLocal = existsSync(join(root, ".env.local"))
  ? readFileSync(join(root, ".env.local"), "utf-8")
  : "";

// Parse actual values from .env.local (format: KEY=VALUE)
const envVars = {};
for (const line of envLocal.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !m[1].startsWith("#")) envVars[m[1]] = m[2];
}

// Validate format only — never check actual values
const hasSupabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"]?.startsWith(
  "https://",
);
const hasAnonKey =
  envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"]?.startsWith("eyJ");

const required = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", check: hasSupabaseUrl },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", check: hasAnonKey },
];


const recommended = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "MINIMAX_API_KEY",
];

for (const { key, check } of required) {
  if (check) {
    pass(`${key} configurada (formato válido)`);
  } else {
    fail(`${key} no configurada o con formato inválido (requerida para producción)`);
  }
}

for (const key of recommended) {
  const value = envVars[key] ?? process.env[key];
  if (value && !value.includes("your-") && !value.includes("...")) {
    pass(`${key} configurada`);
  } else {
    warn(`${key} no configurada (recomendada)`);
  }
}

// ──────────────────────────────────────────────
// 3. Code quality
// ──────────────────────────────────────────────
header("3. Code quality");

console.log("  Running lint...");
const lintStart = Date.now();
const lintOut = run("npm run lint 2>&1");
const lintTime = Date.now() - lintStart;
if (lintOut.includes("error") || /✖/.test(lintOut)) {
  fail(`Lint falló (${lintTime}ms)`);
  console.log(lintOut.split("\n").slice(-10).join("\n"));
} else {
  pass(`Lint passed (${lintTime}ms)`);
}

console.log("  Running typecheck...");
const tcStart = Date.now();
const tcOut = run("npx tsc --noEmit 2>&1");
const tcTime = Date.now() - tcStart;
if (tcOut.trim()) {
  fail(`Typecheck falló (${tcTime}ms)`);
  console.log(tcOut);
} else {
  pass(`Typecheck passed (${tcTime}ms)`);
}

// ──────────────────────────────────────────────
// 4. Tests
// ──────────────────────────────────────────────
header("4. Tests");

console.log("  Running tests...");
const testStart = Date.now();
const testOut = run("npm test 2>&1");
const testTime = Date.now() - testStart;
// vitest exit 0 means all passed
const testPassed = !testOut.includes("failed") && !testOut.includes("FAIL");
if (testPassed) {
  const testCount = (testOut.match(/Tests\s+(\d+)/) || [])[1];
  pass(`Tests passed${testCount ? ` (${testCount} tests)` : ""} (${testTime}ms)`);
} else {
  fail(`Tests fallaron (${testTime}ms)`);
  console.log(testOut.split("\n").slice(-20).join("\n"));
}

// ──────────────────────────────────────────────
// 5. Build
// ──────────────────────────────────────────────
header("5. Production build");

console.log("  Running next build...");
const buildStart = Date.now();
const buildOut = run("npm run build 2>&1");
const buildTime = Date.now() - buildStart;
// Extract route count from table — sum `ƒ` (dynamic) and `○` (static) routes
const routeLines = buildOut.split("\n").filter((l) => /^[├└┌]\s+[ƒ○]/.test(l));
const routeCount = routeLines.length;
if (
  buildOut.includes("Compiled successfully") ||
  buildOut.includes("Compiled successfully")
) {
  pass(`Build succeeded — ${routeCount} rutas (${buildTime}ms)`);
} else {
  fail(`Build falló (${buildTime}ms)`);
  console.log(buildOut.split("\n").slice(-15).join("\n"));
}

// ──────────────────────────────────────────────
// 6. Migrations
// ──────────────────────────────────────────────
header("6. Migrations");

const migrations = [
  "supabase/migrations/0001_initial.sql",
  "supabase/migrations/0002_storage_buckets.sql",
];
for (const path of migrations) {
  if (existsSync(join(root, path))) {
    pass(`${path} existe`);
  } else {
    fail(`${path} no encontrado`);
  }
}

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────
console.log("\n" + "─".repeat(50));
if (failures === 0) {
  console.log(
    `${GREEN}${BOLD}✓ Pre-flight passed${RESET} — ${checksRun} checks`,
  );
  console.log(
    `\n${CYAN}Siguiente paso:${RESET} seguí el runbook en ${BOLD}DEPLOY.md${RESET}`,
  );
  process.exit(0);
} else {
  console.log(
    `${RED}${BOLD}✗ Pre-flight failed${RESET} — ${failures} errors, ${checksRun} checks`,
  );
  console.log(
    `\n${YELLOW}Arreglá los errores antes de deployar.${RESET}`,
  );
  process.exit(1);
}
