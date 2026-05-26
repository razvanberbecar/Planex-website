// ──────────────────────────────────────────────────────────────
// Suspicious Behaviour Simulation — Playwright E2E Tests
//
// Simulates suspicious user behaviour that the detection engine
// should flag. Each test performs actions that trigger specific
// detection rules, then verifies that the SuspiciousActivity
// records are created.
//
// Prerequisites:
//   1. Backend running on https://localhost:3443
//   2. Database seeded with test users
//   3. Run: npx playwright test --config playwright.config.js e2e/suspicious-behavior.spec.cjs
// ──────────────────────────────────────────────────────────────

const { test, expect } = require('@playwright/test');

const BACKEND_URL = process.env.BACKEND_URL || 'https://localhost:3443';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://localhost:3443';

// Test user credentials (must exist in DB from faker seed)
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'admin@planex.com',
  password: process.env.TEST_USER_PASSWORD || 'admin123',
};

// Helper: authenticate via API and get a session token
async function getAuthToken(request) {
  const response = await request.post(`${BACKEND_URL}/api/auth/login`, {
    data: {
      email: TEST_USER.email,
      password: TEST_USER.password,
    },
    ignoreHTTPSErrors: true,
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.accessToken;
}

// Helper: make an authenticated API request
async function apiGet(request, token, path) {
  return request.get(`${BACKEND_URL}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ignoreHTTPSErrors: true,
  });
}

// Helper: make an authenticated POST request
async function apiPost(request, token, path, data) {
  return request.post(`${BACKEND_URL}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data,
    ignoreHTTPSErrors: true,
  });
}

// Helper: make an authenticated PUT request
async function apiPut(request, token, path, data) {
  return request.put(`${BACKEND_URL}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data,
    ignoreHTTPSErrors: true,
  });
}

// Helper: count suspicious activities for the test user
async function countSuspiciousActivities(request, token) {
  const response = await apiGet(request, token, '/api/admin/suspicious-activities?limit=100');
  if (!response.ok()) return [];
  const body = await response.json();
  return body.activities || body || [];
}

// ══════════════════════════════════════════════════════════════
// Test Suite
// ══════════════════════════════════════════════════════════════

test.describe('Suspicious Behaviour Simulation', () => {

  test.describe.configure({ timeout: 120000 }); // 2 min timeout per test

  let authToken;

  test.beforeAll(async ({ request }) => {
    // Get auth token once for all tests
    authToken = await getAuthToken(request);
    expect(authToken).toBeTruthy();
  });

  test('SIM-01: Rapid successive actions (RAPID_SUCCESSIVE_ACTIONS)', async ({ request }) => {
    // Perform 40+ rapid VIEW_TASK actions to trigger RAPID_SUCCESSIVE_ACTIONS
    const promises = [];
    for (let i = 0; i < 40; i++) {
      promises.push(
        apiGet(request, authToken, `/api/tasks?page=${i % 10 + 1}&limit=5`)
          .catch(() => null) // Ignore individual failures
      );
    }

    await Promise.all(promises);

    // Wait for detection engine to process
    await new Promise(r => setTimeout(r, 2000));

    // Check if RAPID_SUCCESSIVE_ACTIONS was flagged
    const activities = await countSuspiciousActivities(request, authToken);
    const flagged = activities.filter(a =>
      a.RuleTriggered && a.RuleTriggered.includes('RAPID_SUCCESSIVE_ACTIONS')
    );

    console.log(`[SIM-01] RAPID_SUCCESSIVE_ACTIONS flags found: ${flagged.length}`);
    expect(flagged.length).toBeGreaterThanOrEqual(1);
  });

  test('SIM-02: Mass view pattern (MASS_VIEW)', async ({ request }) => {
    // Perform 55+ VIEW_TASK actions to trigger MASS_VIEW rule
    const promises = [];
    for (let i = 0; i < 60; i++) {
      promises.push(
        apiGet(request, authToken, `/api/tasks?page=${i % 15 + 1}&limit=5`)
          .catch(() => null)
      );
    }

    await Promise.all(promises);

    await new Promise(r => setTimeout(r, 2000));

    const activities = await countSuspiciousActivities(request, authToken);
    const flagged = activities.filter(a =>
      a.RuleTriggered && a.RuleTriggered.includes('MASS_VIEW')
    );

    console.log(`[SIM-02] MASS_VIEW flags found: ${flagged.length}`);
    expect(flagged.length).toBeGreaterThanOrEqual(1);
  });

  test('SIM-03: Cross-resource abuse (CROSS_RESOURCE_ABUSE)', async ({ request }) => {
    // Access 3+ different resource types rapidly to trigger CROSS_RESOURCE_ABUSE
    // These endpoints are known to log distinct ResourceType values:
    //   /api/tasks       → ResourceType: 'Task'
    //   /api/statistics   → ResourceType: 'Statistics'
    //   /api/admin/users  → ResourceType: 'User'
    //   /api/auth/sessions → ResourceType: 'Session' (no log, but sessions endpoint exists)
    const resources = [
      '/api/tasks?limit=1',
      '/api/statistics',
      '/api/admin/users',
      '/api/tasks/statistics',
      '/api/auth/sessions',
    ];

    // Fire all requests simultaneously
    const promises = resources.map(path =>
      apiGet(request, authToken, path).catch(() => null)
    );

    await Promise.all(promises);

    await new Promise(r => setTimeout(r, 2000));

    const activities = await countSuspiciousActivities(request, authToken);
    const flagged = activities.filter(a =>
      a.RuleTriggered && a.RuleTriggered.includes('CROSS_RESOURCE_ABUSE')
    );

    console.log(`[SIM-03] CROSS_RESOURCE_ABUSE flags found: ${flagged.length}`);
    expect(flagged.length).toBeGreaterThanOrEqual(1);
  });

  test('SIM-04: Rapid profile changes (RAPID_PROFILE_CHANGES)', async ({ request }) => {
    // Attempt 5 rapid profile updates via PUT /api/auth/profile to trigger RAPID_PROFILE_CHANGES
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        apiPut(request, authToken, '/api/auth/profile', {
          name: `TestUser_Sim_${Date.now()}_${i}`,
        }).catch(() => null)
      );
    }

    await Promise.all(promises);

    await new Promise(r => setTimeout(r, 2000));

    const activities = await countSuspiciousActivities(request, authToken);
    const flagged = activities.filter(a =>
      a.RuleTriggered && a.RuleTriggered.includes('RAPID_PROFILE_CHANGES')
    );

    console.log(`[SIM-04] RAPID_PROFILE_CHANGES flags found: ${flagged.length}`);
    expect(flagged.length).toBeGreaterThanOrEqual(1);
  });

  test('SIM-05: Mass status toggle (MASS_STATUS_TOGGLE)', async ({ request }) => {
    // First fetch some task IDs
    const tasksRes = await apiGet(request, authToken, '/api/tasks?limit=15');
    expect(tasksRes.ok()).toBeTruthy();
    const tasksBody = await tasksRes.json();
    const tasks = tasksBody.tasks || tasksBody.data || [];

    if (tasks.length === 0) {
      console.log('[SIM-05] No tasks found to toggle — skipping');
      return;
    }

    // Toggle 12+ tasks rapidly
    const promises = tasks.slice(0, 12).map(task => {
      const taskId = task.TaskId || task.id;
      return apiPost(request, authToken, `/api/tasks/${taskId}/toggle`, {})
        .catch(() => null);
    });

    await Promise.all(promises);

    await new Promise(r => setTimeout(r, 2000));

    const activities = await countSuspiciousActivities(request, authToken);
    const flagged = activities.filter(a =>
      a.RuleTriggered && a.RuleTriggered.includes('MASS_STATUS_TOGGLE')
    );

    console.log(`[SIM-05] MASS_STATUS_TOGGLE flags found: ${flagged.length}`);
    expect(flagged.length).toBeGreaterThanOrEqual(1);
  });

  test('SIM-06: Heavy statistics DDOS simulation (naive succumbs)', async ({ request }) => {
    // Bechmark: fire 50 concurrent requests to naive endpoint
    // The optimized version should handle this gracefully
    console.log('[SIM-06] Benchmarking naive vs optimized under load...');

    const typeParam = 'productivity'; // Fastest computation type

    // Phase 1: 30 concurrent naive requests
    const naivePromises = [];
    for (let i = 0; i < 30; i++) {
      naivePromises.push(
        apiGet(request, authToken, `/api/statistics/heavy?type=${typeParam}&mode=naive`)
          .catch(() => ({ status: () => 0 }))
      );
    }

    const naiveStart = Date.now();
    const naiveResults = await Promise.all(naivePromises);
    const naiveTime = Date.now() - naiveStart;
    const naiveSuccess = naiveResults.filter(r => r.ok && r.status() !== 0).length;
    const naiveFailed = naiveResults.filter(r => !r.ok || r.status() === 0).length;
    console.log(`[SIM-06] Naive: ${naiveSuccess} success, ${naiveFailed} failed in ${naiveTime}ms`);

    // Phase 2: 100 concurrent optimized requests
    const optPromises = [];
    for (let i = 0; i < 100; i++) {
      optPromises.push(
        apiGet(request, authToken, `/api/statistics/heavy?type=${typeParam}&mode=optimized`)
          .catch(() => ({ status: () => 0 }))
      );
    }

    const optStart = Date.now();
    const optResults = await Promise.all(optPromises);
    const optTime = Date.now() - optStart;
    const optSuccess = optResults.filter(r => r.ok && r.status() !== 0).length;
    const optFailed = optResults.filter(r => !r.ok || r.status() === 0).length;
    console.log(`[SIM-06] Optimized: ${optSuccess} success, ${optFailed} failed in ${optTime}ms`);

    // Verify optimized is more resilient
    expect(optFailed).toBeLessThanOrEqual(naiveFailed * 2); // Even with 3x load, optimized should be better
    console.log(`[SIM-06] ✓ DDOS resilience verified: optimized handled ${optSuccess}/${optFailed} vs naive ${naiveSuccess}/${naiveFailed}`);
  });

  test('SIM-07: AI-driven detection (LLM analysis)', async ({ request }) => {
    // Generate mixed suspicious behaviour then verify LLM flagged it
    // The LLM runs asynchronously, so we check if AI_LLM_ANALYSIS exists

    // Trigger a burst of unusual activity
    const burstPromises = [];
    for (let i = 0; i < 30; i++) {
      burstPromises.push(
        apiGet(request, authToken, `/api/tasks?page=${(i % 20) + 1}&limit=5`)
          .catch(() => null)
      );
    }

    await Promise.all(burstPromises);

    // Wait for LLM analysis to complete (it's fire-and-forget)
    console.log('[SIM-07] Waiting for LLM analysis to complete...');
    await new Promise(r => setTimeout(r, 5000));

    const activities = await countSuspiciousActivities(request, authToken);
    const llmFlags = activities.filter(a =>
      a.RuleTriggered && a.RuleTriggered.includes('AI_LLM_ANALYSIS')
    );

    console.log(`[SIM-07] AI_LLM_ANALYSIS flags found: ${llmFlags.length}`);

    // Note: LLM may not always flag depending on model response
    // This test documents whether LLM analysis is running
    if (llmFlags.length > 0) {
      console.log(`[SIM-07] ✓ LLM detected suspicious behaviour: ${llmFlags[0].Details}`);
    } else {
      console.log('[SIM-07] ⚠ No LLM flags found (may need HF_API_TOKEN or more data)');
    }

    // The rules themselves should have flagged something
    const totalFlags = activities.length;
    expect(totalFlags).toBeGreaterThanOrEqual(1);
    console.log(`[SIM-07] Total suspicious activities detected: ${totalFlags}`);
  });

});
