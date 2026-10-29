import { createTransport } from 'nodemailer';

// Sending the daily report (daily-email-report): Gmail over SMTP with an app password
// (myaccount.google.com/apppasswords, needs 2-step verification), the user's choice on 2026-10-29.
// Behind an interface so the tests never reach a mail server.

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export const MAILER = Symbol('MAILER');

/** Null without credentials: then nothing is sent and the report says why. */
export function gmailMailer(env: NodeJS.ProcessEnv = process.env): Mailer | null {
  const user = env.DAILY_REPORT_SMTP_USER?.trim();
  // Google shows the app password in groups of four ("abcd efgh ..."); the spaces aren't part of it.
  const pass = env.DAILY_REPORT_SMTP_PASSWORD?.replace(/\s+/g, '');
  if (!user || !pass) return null;
  const transport = createTransport({ service: 'gmail', auth: { user, pass } });
  return {
    async send(message) {
      await transport.sendMail({ from: `Calendar Productivity <${user}>`, ...message });
    },
  };
}
