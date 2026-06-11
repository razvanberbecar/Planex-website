const Groq = require('groq-sdk')

const SYSTEM_PROMPT = `You are a project management assistant. When given a task title and description, respond with ONLY a JSON array of 3 to 5 concise, actionable subtask titles. No explanation, no markdown, no extra text — just the raw JSON array of strings.`

async function suggestSubtasks(title, description) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured on the server.')
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Task title: "${title}"\nDescription: "${description || 'No description provided.'}"\n\nReturn 3–5 subtasks as a JSON array of strings.`,
      },
    ],
    temperature: 0.6,
    max_tokens: 300,
  })

  const raw = completion.choices[0]?.message?.content?.trim() || ''

  const match = raw.match(/\[[\s\S]*?\]/)
  if (!match) throw new Error('AI returned an unexpected format. Please try again.')

  const parsed = JSON.parse(match[0])
  if (!Array.isArray(parsed)) throw new Error('AI returned an unexpected format. Please try again.')

  return parsed
    .filter(s => typeof s === 'string' && s.trim())
    .map(s => s.trim())
    .slice(0, 6)
}

// ── Toxicity check ────────────────────────────────────────────────────────────
const TOXICITY_PROMPT = `You are a content moderation system. Determine if the following chat message contains toxic, offensive, hateful, or harmful content — including profanity, insults, harassment, threats, hate speech, or encouragement of self-harm. Respond with ONLY valid JSON in the form {"toxic":true} or {"toxic":false}. No explanation, no extra text.`

async function checkToxicity(text) {
  if (!process.env.GROQ_API_KEY) {
    // If no key configured, allow the message through
    return { toxic: false }
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: TOXICITY_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0,
      max_tokens: 20,
    })

    const raw = completion.choices[0]?.message?.content?.trim() || '{}'
    const match = raw.match(/\{[\s\S]*?\}/)
    if (!match) return { toxic: false }

    const parsed = JSON.parse(match[0])
    return { toxic: Boolean(parsed.toxic) }
  } catch (err) {
    console.error('[AI] checkToxicity error:', err.message)
    // Fail open — don't block messages if AI is unavailable
    return { toxic: false }
  }
}

module.exports = { suggestSubtasks, checkToxicity }
