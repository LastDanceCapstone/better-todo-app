import { Resend } from 'resend';

type SendPasswordResetEmailParams = {
  to: string;
  token: string;
};

const resendApiKey = process.env.RESEND_API_KEY;
const mailFrom = process.env.MAIL_FROM;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendPasswordResetEmail(params: SendPasswordResetEmailParams) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  if (!mailFrom) {
    throw new Error('MAIL_FROM is not configured');
  }

  await resend.emails.send({
    from: mailFrom,
    to: params.to,
    subject: 'Reset your password',
    text: `Your password reset token is: ${params.token}\n\nThis token expires in 30 minutes.`,
  });
}
