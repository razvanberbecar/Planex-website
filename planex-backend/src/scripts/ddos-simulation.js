// ──────────────────────────────────────────────────────────────
// DDOS Simulation Script
//
// Simulates a distributed denial-of-service attack against
// the /api/statistics/heavy endpoint to compare how the naive
// implementation succumbs vs the optimized + cached version.
//
// Usage:
//   node src/scripts/ddos-simulation.js
//
// Set BASE_URL env var to target a specific server
// (default: https://localhost:5173)
// ──────────────────────────────────────────────────────────────

const http = require('http');
const https = require('https');
const url = require('url');

const BASE_URL = process.env.BASE_URL || 'https://localhost:5173';
const CONCURRENCY_NAIVE = parseInt(process.env.CONCURRENCY_NAIVE || '30', 10);
const CONCURRENCY_OPTIMIZED = parseInt(process.env.CONCURRENCY_OPTIMIZED || '100', 10);
const DURATION_MS = parseInt(process.env.DURATION_MS || '15000', 10); // 15 seconds per test
const COOLDOWN_MS = parseInt(process.env.COOLDOWN_MS || '5000', 10);  // 5 seconds between tests

// ── Helpers ──────────────────────────────────────────────────

function parseUrl(target) {
  const parsed = new URL(target);
  return {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    protocol: parsed.protocol,
    path: parsed.pathname,
  };
}

function makeRequest(targetUrl, path, sessionToken) {
  return new Promise((resolve) => {
    const parsed = parseUrl(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken || 'test-token'}`,
          'User-Agent': 'DDOS-Simulation/1.0',
        },
        rejectUnauthorized: false, // Allow self-signed certs
        timeout: 30000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            bodyLength: body.length,
            success: res.statusCode >= 200 && res.statusCode < 500,
          });
        });
      }
    );

    req.on('error', (err) => {
      resolve({ statusCode: 0, bodyLength: 0, success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 0, bodyLength: 0, success: false, error: 'TIMEOUT' });
    });

    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Statistics ───────────────────────────────────────────────

function computeStats(results) {
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const timeouts = results.filter(r => r.error === 'TIMEOUT').length;
  const statusCodes = {};
  for (const r of results) {
    const code = r.statusCode || 'ERR';
    statusCodes[code] = (statusCodes[code] || 0) + 1;
  }

  const durations = results
    .filter(r => r.duration !== undefined)
    .map(r => r.duration)
    .sort((a, b) => a - b);

  return {
    total: results.length,
    success,
    failed,
    timeouts,
    statusCodes,
  };
}

// ── Main Simulation ──────────────────────────────────────────

async function runAttack(label, mode, concurrency, durationMs) {
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  ATTACK: ${label.padEnd(48)}║`);
  console.log(`║  Mode: ${mode.padEnd(52)}║`);
  console.log(`║  Concurrency: ${String(concurrency).padEnd(45)}║`);
  console.log(`║  Duration: ${String(durationMs / 1000).padEnd(14)}s${' '.repeat(34)}║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);

  const results = [];
  const startTime = Date.now();
  const endTime = startTime + durationMs;
  let active = 0;
  let completed = 0;

  // Fetch a session token first (from login)
  let sessionToken = process.env.AUTH_TOKEN || '';
  if (!sessionToken) {
    try {
      // Use HTTPS library to POST login credentials
      const loginPayload = JSON.stringify({ email: 'admin@planex.com', password: 'admin123' });
      const loginResult = await new Promise((resolve, reject) => {
        const parsed = parseUrl(BASE_URL);
        const isHttps = parsed.protocol === 'https:';
        const lib = isHttps ? https : http;
        const postData = JSON.stringify({ email: 'admin@planex.com', password: 'admin123' });
        const req = lib.request(
          {
            hostname: parsed.hostname,
            port: parsed.port,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
            },
            rejectUnauthorized: false,
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
              try { resolve(JSON.parse(body)); } catch { resolve(null); }
            });
          }
        );
        req.on('error', reject);
        req.write(postData);
        req.end();
      });
      if (loginResult && loginResult.accessToken) {
        sessionToken = loginResult.accessToken;
      } else {
        sessionToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJVc2VySWQiOjMsIlJvbGVJZCI6Niwicm9sZU5hbWUiOiJhZG1pbiIsImlhdCI6MTc3OTAwNzY0MCwiZXhwIjoxNzc5MDA4NTQwfQ.naaCHhTpSY_qo9HigrxWwS9jOpU_HPh1baQuUANyKwg';
      }
    } catch {
      sessionToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJVc2VySWQiOjMsIlJvbGVJZCI6Niwicm9sZU5hbWUiOiJhZG1pbiIsImlhdCI6MTc3OTAwNzY0MCwiZXhwIjoxNzc5MDA4NTQwfQ.naaCHhTpSY_qo9HigrxWwS9jOpU_HPh1baQuUANyKwg';
    }
  }

  // Use a generic type that works: "productivity" is fast even naive
  const path = `/api/statistics/heavy?type=productivity&mode=${mode}`;

  // Fire requests in a loop until time is up
  while (Date.now() < endTime) {
    // Limit concurrency
    if (active >= concurrency) {
      await sleep(10);
      continue;
    }

    active++;
    const reqStart = Date.now();

    makeRequest(BASE_URL, path, sessionToken).then((res) => {
      const duration = Date.now() - reqStart;
      active--;
      completed++;
      results.push({ ...res, duration });

      if (completed % 50 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        process.stdout.write(`\r  [${elapsed}s] ${completed} requests completed...`);
      }
    });

    // Small delay to avoid overwhelming event loop
    if (concurrency > 50) {
      await sleep(1);
    }
  }

  // Wait for active requests to finish (with timeout)
  const waitStart = Date.now();
  while (active > 0 && Date.now() - waitStart < 10000) {
    await sleep(100);
  }

  console.log(`\r  [${((Date.now() - startTime) / 1000).toFixed(1)}s] ${completed} requests total.     `);

  const stats = computeStats(results);
  console.log(`\n  Results for ${label}:`);
  console.log(`    Total:     ${stats.total}`);
  console.log(`    Success:   ${stats.success}`);
  console.log(`    Failed:    ${stats.failed}`);
  console.log(`    Timeouts:  ${stats.timeouts}`);
  console.log(`    Status codes: ${JSON.stringify(stats.statusCodes)}`);

  // Calculate throughput
  const elapsedSec = (Date.now() - startTime) / 1000;
  const throughput = stats.total / elapsedSec;
  console.log(`    Throughput: ${throughput.toFixed(1)} req/s`);

  return { stats, throughput };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        DDOS SIMULATION — Naive vs Optimized Statistics      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Naive concurrency: ${CONCURRENCY_NAIVE}, Optimized concurrency: ${CONCURRENCY_OPTIMIZED}`);
  console.log(`Test duration: ${DURATION_MS / 1000}s per mode`);
  console.log('');

  // ── Phase 1: Attack naive endpoint ──
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 1: ATTACKING NAIVE ENDPOINT (expect slowdown / failure)');
  console.log('═'.repeat(60));
  const naiveResult = await runAttack(
    'Naive (N+1 queries, O(n³) loops, no cache)',
    'naive',
    CONCURRENCY_NAIVE,
    DURATION_MS
  );

  // Cool down
  console.log(`\n  Cooling down for ${COOLDOWN_MS / 1000}s...`);
  await sleep(COOLDOWN_MS);

  // ── Phase 2: Attack optimized endpoint ──
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 2: ATTACKING OPTIMIZED ENDPOINT (expect resilience)');
  console.log('═'.repeat(60));
  const optimizedResult = await runAttack(
    'Optimized (single SQL, indexes, node-cache)',
    'optimized',
    CONCURRENCY_OPTIMIZED,
    DURATION_MS
  );

  // ── Summary ──
  console.log('\n' + '╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    FINAL COMPARISON                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  ${'Metric'.padEnd(30)} ${'Naive'.padEnd(20)} ${'Optimized'.padEnd(20)}`);
  console.log(`  ${'─'.repeat(30)} ${'─'.repeat(20)} ${'─'.repeat(20)}`);
  console.log(`  ${'Concurrency'.padEnd(30)} ${String(CONCURRENCY_NAIVE).padEnd(20)} ${String(CONCURRENCY_OPTIMIZED).padEnd(20)}`);
  console.log(`  ${'Total requests'.padEnd(30)} ${String(naiveResult.stats.total).padEnd(20)} ${String(optimizedResult.stats.total).padEnd(20)}`);
  console.log(`  ${'Successful'.padEnd(30)} ${String(naiveResult.stats.success).padEnd(20)} ${String(optimizedResult.stats.success).padEnd(20)}`);
  console.log(`  ${'Failed'.padEnd(30)} ${String(naiveResult.stats.failed).padEnd(20)} ${String(optimizedResult.stats.failed).padEnd(20)}`);
  console.log(`  ${'Timeouts'.padEnd(30)} ${String(naiveResult.stats.timeouts).padEnd(20)} ${String(optimizedResult.stats.timeouts).padEnd(20)}`);
  console.log(`  ${'Throughput (req/s)'.padEnd(30)} ${String(naiveResult.throughput.toFixed(1)).padEnd(20)} ${String(optimizedResult.throughput.toFixed(1)).padEnd(20)}`);

  const speedup = optimizedResult.throughput > 0
    ? (naiveResult.throughput / optimizedResult.throughput).toFixed(1)
    : 'N/A';
  console.log(`  ${'Speedup factor'.padEnd(30)} ${''.padEnd(20)} ${speedup}`);
  console.log('');

  if (naiveResult.stats.failed > naiveResult.stats.success) {
    console.log('  ✓ CONFIRMED: Naive implementation succumbs under load.');
  } else {
    console.log('  ⚠ Naive survived (lower concurrency). Increase CONCURRENCY_NAIVE.');
  }

  if (optimizedResult.stats.failed < naiveResult.stats.failed) {
    console.log('  ✓ CONFIRMED: Optimized implementation is more resilient.');
  } else {
    console.log('  ⚠ Optimized did not show improvement (may need more concurrency).');
  }

  // Exit with summary
  process.exit(naiveResult.stats.failed > 0 ? 0 : 0);
}

main().catch((err) => {
  console.error('DDOS Simulation failed:', err);
  process.exit(1);
});
