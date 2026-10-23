/**
 * Transactional email (verification + password reset).
 *
 * Two sending routes, in priority order:
 *
 * 1. SMTP (SMTP_USER + SMTP_PASS set) — works with a Gmail account and a
 *    Google App Password (SMTP_HOST defaults to smtp.gmail.com, SMTP_PORT
 *    to 465). Any SMTP mailbox works the same way, e.g. a mailbox on the
 *    operator's own domain. SMTP_FROM overrides the From header.
 * 2. Resend API (RESEND_API_KEY set) — EMAIL_FROM overrides the sender;
 *    otherwise Resend's onboarding sender is used, which can only deliver
 *    to the Resend account owner's inbox.
 *
 * When neither is configured (or sending fails), sendMail returns false
 * and the callers fall back to showing the link ON SCREEN (setup mode) —
 * the flows must work end-to-end either way, because the platform
 * operator may not have connected an email provider yet.
 */
import nodemailer from "nodemailer";

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim(),
  );
}

export function mailerConfigured(): boolean {
  return smtpConfigured() || Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Public base URL used to build links inside emails. */
export function appBaseUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

async function sendViaSmtp(args: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const user = process.env.SMTP_USER!.trim();
  // Google shows App Passwords in 4 blocks of 4 with spaces; the spaces
  // are not part of the password, so strip them before authenticating.
  const pass = process.env.SMTP_PASS!.replace(/\s+/g, "");
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT?.trim() || "465") || 465;
  const from =
    process.env.SMTP_FROM?.trim() || `Inventory Management System <${user}>`;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS; other ports use STARTTLS when offered
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    await transport.sendMail({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
    });
    return true;
  } catch {
    return false;
  } finally {
    transport.close();
  }
}

async function sendViaResend(args: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from =
    process.env.EMAIL_FROM?.trim() ||
    "Inventory Management System <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendMail(args: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  if (smtpConfigured()) return sendViaSmtp(args);
  if (process.env.RESEND_API_KEY?.trim()) return sendViaResend(args);
  return false;
}

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string,
): Promise<boolean> {
  return sendMail({
    to,
    subject: "Verify your email — Inventory Management System",
    text: [
      "Welcome to the Inventory Management System.",
      "",
      "Please verify your email address to activate your store owner account:",
      verifyUrl,
      "",
      "This link expires in 24 hours. If you did not create this account, you can ignore this email.",
    ].join("\n"),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<boolean> {
  return sendMail({
    to,
    subject: "Reset your password — Inventory Management System",
    text: [
      "A password reset was requested for your Inventory Management System account.",
      "",
      "Set a new password here:",
      resetUrl,
      "",
      "This link expires in 1 hour and can be used once. If you did not request it, you can ignore this email.",
    ].join("\n"),
  });
}
