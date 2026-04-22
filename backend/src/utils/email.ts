import { Resend } from 'resend';
import { env } from '../config/env';

type SendPasswordResetEmailParams = {
  to: string;
  code: string;
  resetUrl: string;
  expiresInMinutes: number;
};

type SendEmailVerificationParams = {
  to: string;
  code: string;
  verifyUrl: string;
  expiresInMinutes: number;
};

const resendApiKey = env.RESEND_API_KEY;
const mailFrom = env.MAIL_FROM;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const buildEmailShell = (content: string): string => {
  return `
  <html>
    <body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
              <tr>
                <td align="center" style="padding:24px 24px 8px 24px;">
                  <div style="font-size:22px;font-weight:700;letter-spacing:0.2px;color:#0f172a;">Prioritize</div>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 24px 24px 24px;">
                  ${content}
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin-top:12px;">
              <tr>
                <td align="center" style="font-size:12px;line-height:18px;color:#64748b;padding:0 12px;">
                  You are receiving this email because you have an account with Prioritize.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `.trim();
};

export async function sendPasswordResetEmail(params: SendPasswordResetEmailParams) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  if (!mailFrom) {
    throw new Error('MAIL_FROM is not configured');
  }

  const safeCode = escapeHtml(params.code);
  const safeResetUrl = escapeHtml(params.resetUrl);

  await resend.emails.send({
    from: mailFrom,
    to: params.to,
    subject: 'Reset your password for Prioritize',
    html: buildEmailShell(`
      <h1 style="margin:0 0 12px 0;font-size:26px;line-height:32px;font-weight:700;color:#0f172a;text-align:center;">Reset your password</h1>
      <p style="margin:0 0 18px 0;font-size:15px;line-height:24px;color:#334155;text-align:center;">We received a request to reset your password.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px 0;">
        <tr>
          <td align="center">
            <a href="${safeResetUrl}" style="display:inline-block;background:#004aad;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:12px 20px;border-radius:10px;">Reset Password</a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;color:#334155;">If the button doesn’t work, use this code in the app:</p>
      <div style="text-align:center;margin:0 0 12px 0;">
        <span style="display:inline-block;letter-spacing:6px;font-size:28px;font-weight:700;color:#0f172a;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:10px 16px;">${safeCode}</span>
      </div>
      <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;color:#64748b;">This code will expire in ${params.expiresInMinutes} minutes.</p>
      <p style="margin:0;font-size:13px;line-height:20px;color:#64748b;">If you didn’t request this, you can safely ignore this email.</p>
    `),
    text:
      `We received a request to reset your Prioritize password.\n\n` +
      `Reset Password: ${params.resetUrl}\n\n` +
      `If the button doesn’t work, use this code in the app: ${params.code}\n\n` +
      `This code will expire in ${params.expiresInMinutes} minutes.\n` +
      `If you didn’t request this, you can safely ignore this email.`,
  });
}

export async function sendEmailVerificationEmail(params: SendEmailVerificationParams) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  if (!mailFrom) {
    throw new Error('MAIL_FROM is not configured');
  }

  const safeCode = escapeHtml(params.code);
  const safeVerifyUrl = escapeHtml(params.verifyUrl);

  await resend.emails.send({
    from: mailFrom,
    to: params.to,
    subject: 'Verify your email for Prioritize',
    html: buildEmailShell(`
      <h1 style="margin:0 0 12px 0;font-size:26px;line-height:32px;font-weight:700;color:#0f172a;text-align:center;">Welcome to Prioritize</h1>
      <p style="margin:0 0 18px 0;font-size:15px;line-height:24px;color:#334155;text-align:center;">Please verify your email to complete your account setup.</p>
      <div style="text-align:center;margin:0 0 12px 0;">
        <span style="display:inline-block;letter-spacing:6px;font-size:28px;font-weight:700;color:#0f172a;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:10px 16px;">${safeCode}</span>
      </div>
      <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;color:#334155;text-align:center;">You can also verify directly using this link:</p>
      <p style="margin:0 0 12px 0;font-size:13px;line-height:20px;text-align:center;word-break:break-all;"><a href="${safeVerifyUrl}" style="color:#004aad;text-decoration:underline;">Verify Email</a></p>
      <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;color:#64748b;">This code expires in ${params.expiresInMinutes} minutes.</p>
      <p style="margin:0;font-size:13px;line-height:20px;color:#64748b;">If you didn’t create this account, you can ignore this email.</p>
    `),
    text:
      `Welcome to Prioritize. Please verify your email to complete your account setup.\n\n` +
      `Verification code: ${params.code}\n` +
      `Verification link: ${params.verifyUrl}\n\n` +
      `This code expires in ${params.expiresInMinutes} minutes.\n` +
      `If you didn’t create this account, you can ignore this email.`,
  });
}
