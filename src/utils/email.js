const { Resend } = require('resend');

let resendClient;

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function wrapBrandedHtml(title, bodyHtml) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#1e293b;border-radius:12px;padding:28px 24px;border:1px solid #334155;">
          <tr>
            <td>
              <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;margin-bottom:8px;color:#38bdf8;">MET Academy</div>
              <div style="font-size:13px;color:#94a3b8;margin-bottom:24px;">Student Portal</div>
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendActivationEmail(to, token) {
  const base =
    process.env.FRONTEND_PUBLIC_URL ||
    process.env.FRONTEND_URL ||
    process.env.BASE_URL ||
    'http://localhost:3000';
  const link = `${base.replace(/\/$/, '')}/activate?token=${encodeURIComponent(token)}`;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error('RESEND_FROM_EMAIL is not configured');
  }
  const html = wrapBrandedHtml(
    'Activate your account',
    `
      <p style="margin:0 0 16px;line-height:1.6;color:#cbd5e1;">Activate your MET Academy student account to get started.</p>
      <p style="margin:0 0 24px;">
        <a href="${link}" style="display:inline-block;background:#38bdf8;color:#0f172a;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">Activate account</a>
      </p>
      <p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;">If the button does not work, copy this link:<br/>${link}</p>
    `
  );
  await getResend().emails.send({
    from,
    to: [to],
    subject: 'Activate your MET Academy account',
    html,
  });
}

async function sendPasswordResetEmail(to, token) {
  const base =
    process.env.FRONTEND_PUBLIC_URL ||
    process.env.FRONTEND_URL ||
    process.env.BASE_URL ||
    'http://localhost:3000';
  const link = `${base.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error('RESEND_FROM_EMAIL is not configured');
  }
  const html = wrapBrandedHtml(
    'Reset your password',
    `
      <p style="margin:0 0 16px;line-height:1.6;color:#cbd5e1;">We received a request to reset your MET Academy password.</p>
      <p style="margin:0 0 24px;">
        <a href="${link}" style="display:inline-block;background:#38bdf8;color:#0f172a;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">Reset password</a>
      </p>
      <p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;">If you did not request this, you can ignore this email.<br/>${link}</p>
    `
  );
  await getResend().emails.send({
    from,
    to: [to],
    subject: 'Reset your MET Academy password',
    html,
  });
}

module.exports = {
  sendActivationEmail,
  sendPasswordResetEmail,
};
