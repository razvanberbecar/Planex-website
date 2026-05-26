// ──────────────────────────────────────────────────────────────
// Email Service
// Handles sending verification codes via email.
// In development mode, codes are logged to console.
// For production, configure SMTP via environment variables.
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
  console.log(`  ║              🔐 VERIFICATION CODE                       ║`);
  console.log(`  ╠══════════════════════════════════════════════════════════╣`);
  console.log(`  ║  To:   ${(to || '').padEnd(47)}║`);
  console.log(`  ║  User: ${(displayName || '').padEnd(47)}║`);
  console.log(`  ║                                                        ║`);
  console.log(`  ║     Your code is:  ${String(code).padEnd(33)}║`);
  console.log(`  ║                                                        ║`);
  console.log(`  ║  ⚠  This code expires in 10 minutes                    ║`);
  console.log(`  ╚══════════════════════════════════════════════════════════╝\n`);

  // ── Production: Send real email via SMTP ──────────────────
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: `"Planex Security" <${process.env.SMTP_FROM || 'noreply@planex.app'}>`,
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

      console.log(`[EmailService] Email sent via SMTP: ${info.messageId}`);
      return info;
    } catch (err) {
      console.error(`[EmailService] SMTP send failed:`, err.message);
      // Fall through - code was already logged to console
    }
  }

  return { messageId: `dev-${Date.now()}` };
}

module.exports = {
  sendVerificationCode,
};
