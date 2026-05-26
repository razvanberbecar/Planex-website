// ──────────────────────────────────────────────────────────────
// Benchmark Runner – compares naive vs optimized for all 5 types
// Usage: node src/scripts/run-benchmark.js
// ──────────────────────────────────────────────────────────────

const { initDatabase } = require('../database/init');
const { performance } = require('perf_hooks');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  await initDatabase();
  const { compute } = require('../services/statisticsService');
  const types = ['density', 'productivity', 'heatmap', 'centrality', 'rhythm'];
  const results = [];

  console.log('\n========== JMETER-STYLE BENCHMARK ==========');
  console.log(`Running ${types.length} computation types × 2 modes (naive + optimized) + cache hit\n`);

  for (const type of types) {
    console.log(`[${type}]`);

    // ── Naive ──────────────────────────────────────────────
    let start = performance.now();
    const naiveResult = await compute(type, 'naive');
    let naiveMs = Math.round(performance.now() - start);
    console.log(`  Naive:      ${naiveMs}ms  (db: ${Math.round(naiveResult.timing.db)}ms, compute: ${Math.round(naiveResult.timing.compute)}ms)`);

    // Wait for cache TTL to expire or flush — let's just add a small delay
    await sleep(100);

    // ── Optimized (first — DB query) ───────────────────────
    start = performance.now();
    const optDbResult = await compute(type, 'optimized');
    let optDbMs = Math.round(performance.now() - start);
    console.log(`  Optimized:  ${optDbMs}ms  (db: ${Math.round(optDbResult.timing.db)}ms, compute: ${Math.round(optDbResult.timing.compute)}ms)`);

    // ── Optimized (second — cache hit) ─────────────────────
    start = performance.now();
    const optCacheResult = await compute(type, 'optimized');
    let optCacheMs = Math.round(performance.now() - start);
    console.log(`  Cached:     ${optCacheMs}ms`);

    const speedupDb = naiveMs > 0 && optDbMs > 0 ? (naiveMs / optDbMs).toFixed(1) : 'N/A';
    const speedupCache = naiveMs > 0 && optCacheMs > 0 ? (naiveMs / optCacheMs).toFixed(1) : 'N/A';

    results.push({ type, naiveMs, optDbMs, optCacheMs, speedupDb, speedupCache });
    console.log('');
  }

  // ── Summary Table ────────────────────────────────────────
  console.log('='.repeat(90));
  console.log('TYPE'.padEnd(18) + ' | NAIVE(ms) | OPT DB(ms) | CACHE(ms) | SPEEDUP DB | SPEEDUP CACHE');
  console.log('-'.repeat(90));
  let totalNaive = 0, totalOptDb = 0, totalCache = 0;
  for (const r of results) {
    totalNaive += r.naiveMs;
    totalOptDb += r.optDbMs;
    totalCache += r.optCacheMs;
    console.log(
      r.type.padEnd(18) + ' | ' +
      String(r.naiveMs).padStart(9) + ' | ' +
      String(r.optDbMs).padStart(10) + ' | ' +
      String(r.optCacheMs).padStart(8) + ' | ' +
      String(r.speedupDb + 'x').padStart(10) + ' | ' +
      String(r.speedupCache + 'x').padStart(13)
    );
  }
  console.log('-'.repeat(90));
  console.log(
    'TOTAL'.padEnd(18) + ' | ' +
    String(totalNaive).padStart(9) + ' | ' +
    String(totalOptDb).padStart(10) + ' | ' +
    String(totalCache).padStart(8) + ' | ' +
    String((totalNaive / Math.max(totalOptDb, 1)).toFixed(1) + 'x').padStart(10) + ' | ' +
    String((totalNaive / Math.max(totalCache, 1)).toFixed(1) + 'x').padStart(13)
  );
  console.log('='.repeat(90));

  // ── Save to JSON ─────────────────────────────────────────
  const fs = require('fs');
  fs.writeFileSync('./benchmark_results.json', JSON.stringify({
    benchmark: results,
    summary: {
      totalNaiveMs: totalNaive,
      totalOptimizedDbMs: totalOptDb,
      totalCachedMs: totalCache,
      overallDbSpeedup: (totalNaive / Math.max(totalOptDb, 1)).toFixed(1) + 'x',
      overallCacheSpeedup: (totalNaive / Math.max(totalCache, 1)).toFixed(1) + 'x',
    }
  }, null, 2));
  console.log('\nResults saved to benchmark_results.json');
  process.exit(0);
}

main().catch(e => {
  console.error('Benchmark failed:', e.message, e.stack);
  process.exit(1);
});
