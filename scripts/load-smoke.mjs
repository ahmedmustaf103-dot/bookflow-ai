/**
 * Lightweight concurrent load smoke for public booking slots.
 *
 * Usage:
 *   LOAD_BASE_URL=http://localhost:3000 \
 *   LOAD_ORG_SLUG=bookflow \
 *   LOAD_CONCURRENCY=20 \
 *   LOAD_REQUESTS=100 \
 *   node scripts/load-smoke.mjs
 *
 * Exits non-zero if error rate > 5% or p95 > 3s.
 */

const base = (process.env.LOAD_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const slug = process.env.LOAD_ORG_SLUG || "";
const concurrency = Number(process.env.LOAD_CONCURRENCY || 10);
const total = Number(process.env.LOAD_REQUESTS || 50);

if (!slug) {
  console.error("Set LOAD_ORG_SLUG to a real public booking org slug.");
  process.exit(1);
}

const url = `${base}/book/${slug}`;

async function one() {
  const started = performance.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html" },
    });
    const ms = performance.now() - started;
    return { ok: res.ok, status: res.status, ms };
  } catch (e) {
    const ms = performance.now() - started;
    return {
      ok: false,
      status: 0,
      ms,
      error: e instanceof Error ? e.message : "error",
    };
  }
}

async function pool(n, limit, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, n) }, async () => {
    while (i < n) {
      const idx = i++;
      results[idx] = await worker();
    }
  });
  await Promise.all(runners);
  return results;
}

const results = await pool(total, concurrency, one);
const ok = results.filter((r) => r.ok).length;
const errors = total - ok;
const times = results.map((r) => r.ms).sort((a, b) => a - b);
const p50 = times[Math.floor(times.length * 0.5)] ?? 0;
const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
const errRate = errors / total;

console.log(
  JSON.stringify(
    {
      url,
      total,
      concurrency,
      ok,
      errors,
      errorRate: Number(errRate.toFixed(3)),
      p50Ms: Math.round(p50),
      p95Ms: Math.round(p95),
    },
    null,
    2,
  ),
);

if (errRate > 0.05 || p95 > 3000) {
  console.error("Load smoke FAILED (errorRate>5% or p95>3000ms)");
  process.exit(1);
}

console.log("Load smoke OK");
