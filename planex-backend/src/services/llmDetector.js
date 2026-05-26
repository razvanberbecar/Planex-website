// ──────────────────────────────────────────────────────────────
// LLM Detector Service — AI-Powered Suspicious Behaviour Analysis
//
// Uses Hugging Face Inference API (free tier) to classify
// user activity patterns as suspicious or legitimate.
// Falls back gracefully if no API key is configured.
// ──────────────────────────────────────────────────────────────

const { HfInference } = require('@huggingface/inference');

// ── Configuration ────────────────────────────────────────────
const HF_API_TOKEN = process.env.HF_API_TOKEN || '';
const ENABLE_LLM   = process.env.ENABLE_LLM_DETECTION === 'true' && HF_API_TOKEN.length > 0;

let hf = null;
if (ENABLE_LLM) {
  hf = new HfInference(HF_API_TOKEN);
  console.log('[LLMDetector] Hugging Face Inference API initialized.');
} else {
  console.log('[LLMDetector] LLM detection DISABLED (set HF_API_TOKEN and ENABLE_LLM_DETECTION=true)');
}

/**
 * Analyse a user's recent activity pattern using an LLM.
 *
 * @param {number} userId
 * @param {Array<object>} recentLogs  — Array of ActivityLog rows (last ~50 actions)
 * @param {Array<object>} existingFlags — Array of existing SuspiciousActivity rows for this user
 * @returns {Promise<{ flagged: boolean, reason: string|null, severity: string|null, confidence: number }>}
 */
async function analyzeWithLLM(userId, recentLogs, existingFlags) {
  if (!ENABLE_LLM || !hf) {
    return { flagged: false, reason: null, severity: null, confidence: 0, message: 'LLM disabled' };
  }

  try {
    // Build a concise activity summary for the LLM
    const activitySummary = buildActivitySummary(userId, recentLogs, existingFlags);
    const prompt = buildPrompt(activitySummary);

    const response = await hf.textGeneration({
      model: 'gpt2',  // Free, lightweight model — sufficient for binary classification
      inputs: prompt,
      parameters: {
        max_new_tokens: 50,
        temperature: 0.3,
        top_p: 0.9,
        do_sample: false,
      },
    });

    const classification = parseLLMResponse(response.generated_text, prompt);
    console.log(`[LLMDetector] User ${userId} classified:`, classification);

    return classification;
  } catch (err) {
    console.error('[LLMDetector] API error:', err.message);
    // Fallback: no flag
    return { flagged: false, reason: `LLM error: ${err.message}`, severity: null, confidence: 0 };
  }
}

/**
 * Build a compact summary of the user's recent activity.
 */
function buildActivitySummary(userId, recentLogs, existingFlags) {
  const actionCounts = {};
  const hourDistribution = {};
  const resourceTypes = new Set();

  for (const log of recentLogs) {
    const action = log.Action || 'UNKNOWN';
    actionCounts[action] = (actionCounts[action] || 0) + 1;

    const hour = log.Timestamp ? new Date(log.Timestamp).getHours() : -1;
    if (hour >= 0) {
      hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
    }

    if (log.ResourceType) resourceTypes.add(log.ResourceType);
  }

  return {
    totalActions: recentLogs.length,
    uniqueActions: Object.keys(actionCounts).length,
    actionCounts,
    hourDistribution,
    resourceTypes: Array.from(resourceTypes),
    uniqueResources: resourceTypes.size,
    windowMinutes: recentLogs.length > 1 && recentLogs[0].Timestamp && recentLogs[recentLogs.length - 1].Timestamp
      ? Math.round((new Date(recentLogs[recentLogs.length - 1].Timestamp) - new Date(recentLogs[0].Timestamp)) / 60000)
      : 0,
    existingFlagCount: existingFlags.length,
    existingSeverities: existingFlags.map(f => f.Severity),
  };
}

/**
 * Build the prompt for the LLM.
 */
function buildPrompt(summary) {
  const actionsStr = Object.entries(summary.actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([action, count]) => `${action}:${count}`)
    .join(', ');

  const hoursStr = Object.entries(summary.hourDistribution)
    .sort((a, b) => a[0] - b[0])
    .map(([h, c]) => `${h}h:${c}`)
    .join(', ');

  return `[Suspicious activity detection]
User activity in last ${summary.windowMinutes}min:
- Total actions: ${summary.totalActions}
- Top actions: ${actionsStr || 'none'}
- Hourly distribution: ${hoursStr || 'unknown'}
- Resource types accessed: ${summary.uniqueResources}
- Existing flags: ${summary.existingFlagCount} (severities: ${summary.existingSeverities.join(', ') || 'none'})
- Question: Is this user behaving suspiciously? Answer YES or NO.`;
}

/**
 * Parse the LLM's free-text response into a structured classification.
 */
function parseLLMResponse(fullText, prompt) {
  // Extract the part after the prompt
  const response = fullText.slice(prompt.length).trim().toUpperCase();

  const isSuspicious = response.includes('YES');
  const confidence = isSuspicious ? 0.65 : 0.35; // Conservative estimate

  if (isSuspicious) {
    const severity = summary.totalActions > 50 || summary.existingFlagCount > 2 ? 'HIGH' : 'MEDIUM';
    return {
      flagged: true,
      reason: `LLM flagged suspicious pattern: ${response.slice(0, 100)}`,
      severity,
      confidence,
    };
  }

  return {
    flagged: false,
    reason: null,
    severity: null,
    confidence,
  };
}

// Store the last summary for parseLLMResponse
let summary = null;

/**
 * Override: classify user activity using LLM.
 * Public wrapper that stores summary for parsing.
 */
async function classifyActivity(userId, recentLogs, existingFlags) {
  summary = buildActivitySummary(userId, recentLogs, existingFlags);
  const result = await analyzeWithLLM(userId, recentLogs, existingFlags);
  summary = null; // cleanup
  return result;
}

module.exports = {
  classifyActivity,
  analyzeWithLLM,
  buildActivitySummary,
  isEnabled: () => ENABLE_LLM,
};
