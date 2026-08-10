/**
 * Lighthouse smoke for marketing + optional booking page.
 *
 * Usage:
 *   LH_BASE_URL=http://127.0.0.1:3000 npm run lighthouse:smoke
 *   LH_BOOK_PATH=/book/your-slug npm run lighthouse:smoke
 *
 * Default gate: scores >= 0.9 (set LH_MIN_SCORE=0.95 for stricter).
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const base = (process.env.LH_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const bookPath = process.env.LH_BOOK_PATH || "";
const minScore = Number(process.env.LH_MIN_SCORE || "0.9");

const urls = [`${base}/`];
if (bookPath) {
  urls.push(
    `${base}${bookPath.startsWith("/") ? bookPath : `/${bookPath}`}`,
  );
}

mkdirSync("lighthouse-reports", { recursive: true });

let failed = false;

for (const url of urls) {
  const out = path.join(
    "lighthouse-reports",
    `${url.replace(/https?:\/\//, "").replace(/[^\w.-]+/g, "_")}.json`,
  );
  const result = spawnSync(
    "npx",
    [
      "lighthouse",
      url,
      "--only-categories=performance,accessibility,best-practices,seo",
      "--chrome-flags=--headless --no-sandbox",
      "--quiet",
      "--output=json",
      `--output-path=${out}`,
    ],
    { encoding: "utf8", shell: process.platform === "win32" },
  );

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    failed = true;
    continue;
  }

  const report = JSON.parse(readFileSync(out, "utf8"));
  const cats = report.categories;
  const scores = {
    performance: cats.performance?.score ?? 0,
    accessibility: cats.accessibility?.score ?? 0,
    bestPractices: cats["best-practices"]?.score ?? 0,
    seo: cats.seo?.score ?? 0,
  };
  console.log(url, scores);

  for (const [k, v] of Object.entries(scores)) {
    if (v < minScore) {
      console.error(`FAIL ${k}=${v} < ${minScore} for ${url}`);
      failed = true;
    }
  }

  writeFileSync(
    out.replace(/\.json$/, ".summary.json"),
    JSON.stringify({ url, scores }, null, 2),
  );
}

if (failed) process.exit(1);
console.log("Lighthouse smoke OK");
