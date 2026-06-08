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

module.exports = { suggestSubtasks }
