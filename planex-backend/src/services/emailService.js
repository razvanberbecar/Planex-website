// ──────────────────────────────────────────────────────────────
// Email Service
// Handles sending verification codes and password reset emails.
// In development mode, all content is logged to console.
// For production, set BREVO_API_KEY (https://brevo.com) — no SMTP needed.
// ──────────────────────────────────────────────────────────────

/**
 * Send a verification code to the user's email.
 * In development, the code is logged to the server console.
 * @param {string} to - Recipient email address
 * @param {string} code - The 6-digit verification code
 * @param {string} [name] - Recipient name for personalization
 * @returns {Promise<object>} send result
 */
async function sendVerificationCode(to, code, name) {
  const displayName = name || to;

  // ── Log the code prominently (works in all environments) ──
  console.log(`\n  ╔══════════════════════════════════════════════════════════╗`);
  console.log(`  ║               VERIFICATION CODE                         ║`);
  console.log(`  ╠══════════════════════════════════════════════════════════╣`);
  console.log(`  ║  To:   ${(to || '').padEnd(47)}║`);
  console.log(`  ║  User: ${(displayName || '').padEnd(47)}║`);
  console.log(`  ║                                                        ║`);
  console.log(`  ║     Your code is:  ${String(code).padEnd(33)}║`);
  console.log(`  ║                                                        ║`);
  console.log(`  ║  [!] This code expires in 10 minutes                   ║`);
  console.log(`  ╚══════════════════════════════════════════════════════════╝\n`);

  // ── Send via Resend API ────────────────────────────────────
  await sendViaBrevo({
    to,
    subject: 'Your Planex Verification Code',
    text: [
      `Hello ${displayName},`,
      '',
      `Your verification code is: ${code}`,
      '',
      'This code will expire in 10 minutes.',
      'If you did not request this code, please ignore this email.',
      '',
      '— Planex Security Team',
    ].join('\n'),
    html: [
      '<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">',
      `  <h2 style="color: #2d3445;">Hello ${displayName},</h2>`,
      '  <p>Your verification code is:</p>',
      `  <div style="background: #f5f5d8; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">`,
      `    <span style="font-size: 2rem; font-weight: bold; letter-spacing: 8px; font-family: monospace; color: #2d3445;">${code}</span>`,
      '  </div>',
      '  <p>This code will expire in <strong>10 minutes</strong>.</p>',
      '  <p style="color: #666; font-size: 0.85rem;">If you did not request this code, please ignore this email.</p>',
      '  <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />',
      '  <p style="color: #999; font-size: 0.8rem;">— Planex Security Team</p>',
      '</div>',
    ].join('\n'),
  });

  return { messageId: `dev-${Date.now()}` };
}

/**
 * Send a password reset email with a clickable link.
 * @param {string} to - Recipient email address
 * @param {string} name - Recipient name
 * @param {string} resetUrl - Full password reset URL (with token and email)
 * @param {Date} expiresAt - Expiry date of the reset token
 * @returns {Promise<object>} send result
 */
async function sendPasswordResetEmail(to, name, resetUrl, expiresAt) {
  const displayName = name || to;
  const expiresStr = expiresAt instanceof Date
    ? expiresAt.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
    : '1 hour';

  // ── Log the reset URL prominently ─────────────────────────
  console.log(`\n  ╔══════════════════════════════════════════════════════════╗`);
  console.log(`  ║             PASSWORD RESET REQUEST                      ║`);
  console.log(`  ╠══════════════════════════════════════════════════════════╣`);
  console.log(`  ║  To:   ${(to || '').padEnd(47)}║`);
  console.log(`  ║  User: ${(displayName || '').padEnd(47)}║`);
  console.log(`  ║                                                        ║`);
  console.log(`  ║  Reset URL:                                            ║`);
  console.log(`  ║  ${(resetUrl || '').padEnd(55)}║`);
  console.log(`  ║                                                        ║`);
  console.log(`  ║  Expires: ${expiresStr.padEnd(38)}║`);
  console.log(`  ║  [!] This link expires in 1 hour                       ║`);
  console.log(`  ╚══════════════════════════════════════════════════════════╝\n`);

  // ── Send via Resend API ────────────────────────────────────
  await sendViaBrevo({
    to,
    subject: 'Reset Your Planex Password',
    text: [
      `Hello ${displayName},`,
      '',
      'You requested a password reset for your Planex account.',
      '',
      `Click the link below to reset your password:`,
      resetUrl,
      '',
      'This link will expire in 1 hour.',
      'If you did not request this password reset, please ignore this email.',
      '',
      '— Planex Security Team',
    ].join('\n'),
    html: [
      '<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">',
      `  <h2 style="color: #2d3445;">Hello ${displayName},</h2>`,
      '  <p>You requested a password reset for your Planex account.</p>',
      '  <p>Click the button below to reset your password:</p>',
      `  <div style="text-align: center; margin: 32px 0;">`,
      `    <a href="${resetUrl}"`,
      `       style="display: inline-block; background: #2d3445; color: #fff;`,
      `              text-decoration: none; padding: 14px 36px; border-radius: 30px;`,
      `              font-size: 1.1rem; font-weight: bold; letter-spacing: 1px;">`,
      `      Reset Password`,
      `    </a>`,
      '  </div>',
      `  <p style="color: #666; font-size: 0.85rem;">`,
      `    This link will expire in <strong>1 hour</strong>.`,
      `  </p>`,
      '  <p style="color: #666; font-size: 0.85rem;">',
      '    If you did not request this password reset, please ignore this email.',
      '  </p>',
      '  <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />',
      '  <p style="color: #999; font-size: 0.8rem;">— Planex Security Team</p>',
      '</div>',
    ].join('\n'),
  });

  return { messageId: `dev-${Date.now()}` };
}

/**
 * Internal helper: send email via Brevo HTTP API.
 * Requires BREVO_API_KEY env var. Falls back silently if not set.
 * Sender address must be verified in your Brevo account (Senders & IP).
 * @param {{ to: string, subject: string, text: string, html: string }} opts
 */
async function sendViaBrevo({ to, subject, text, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('[EmailService] BREVO_API_KEY not set — email not sent.');
    return;
  }

  const senderEmail = process.env.SMTP_FROM || 'noreply@planex.app';

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Planex Security', email: senderEmail },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || `Brevo API error ${res.status}`);
    }

    console.log(`[EmailService] Email sent via Brevo: ${data.messageId}`);
    return data;
  } catch (err) {
    console.error(`[EmailService] Brevo send failed:`, err.message);
    // Fall through — reset URL was already logged to console
  }
}

module.exports = {
  sendVerificationCode,
  sendPasswordResetEmail,
};
