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
 *
 * Presentation: both templates share one Premium Minimalist Card-Based
 * layout (table-based, inline CSS, ~600px) so they render in Gmail,
 * Outlook, and mobile clients without JavaScript or external CSS. The
 * platform logo (Delivery Boy mascot, src/lib/logo.ts) travels as an
 * inline CID attachment on the SMTP route — the reliable way to embed
 * an image in email — instead of a hosted URL or a data URI, which
 * most mail clients strip. The Resend route attaches the same file
 * (its API has no CID inline-image field).
 */
import nodemailer from "nodemailer";
import { LOGO_SRC } from "./logo";

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

/** Escape a URL for safe interpolation into HTML attributes/text. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The platform logo as a mail attachment (CID inline image). */
function logoAttachment(): {
  filename: string;
  content: Buffer;
  cid: string;
} | null {
  const base64 = LOGO_SRC.split(",", 2)[1];
  if (!base64) return null;
  return {
    filename: "logo.jpg",
    content: Buffer.from(base64, "base64"),
    cid: "tienda-logo",
  };
}

/* ------------------------------------------------------------------ */
/* Shared template                                                     */
/* ------------------------------------------------------------------ */

const INDIGO = "#4F46E5";
const INDIGO_DARK = "#4338CA";
const BG = "#F3F4F6";
const CARD = "#FFFFFF";
const TEXT = "#111827";
const MUTED = "#6B7280";
const FONT =
  "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function emailHtml(args: {
  preheader: string;
  heading: string;
  supporting: string;
  message: string;
  buttonLabel: string;
  buttonUrl: string;
  /** Omitted for emails without a token link (e.g. the welcome email). */
  expiryNote?: string;
  securityNote: string;
  /** Omitted unless the email has a support line (e.g. the welcome email). */
  supportNote?: string;
}): string {
  const url = escapeHtml(args.buttonUrl);
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(args.heading)} — Inventory Management System</title>
<style>
@media only screen and (max-width: 600px) {
  .card-padding { padding: 28px 22px !important; }
  .btn-table { width: 100% !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${BG};">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BG};">${escapeHtml(args.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:${CARD};border-radius:12px;">
<tr><td class="card-padding" align="center" style="padding:40px 44px;">
<img src="cid:tienda-logo" width="56" height="56" alt="Inventory Management System" style="display:block;width:56px;height:56px;border:0;outline:none;">
<h1 style="margin:24px 0 8px 0;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;color:${TEXT};">${escapeHtml(args.heading)}</h1>
<p style="margin:0 0 24px 0;font-family:${FONT};font-size:15px;line-height:24px;color:${MUTED};">${escapeHtml(args.supporting)}</p>
<p style="margin:0 0 12px 0;font-family:${FONT};font-size:15px;line-height:24px;color:${TEXT};text-align:left;">Hi there,</p>
<p style="margin:0 0 28px 0;font-family:${FONT};font-size:15px;line-height:24px;color:${TEXT};text-align:left;">${escapeHtml(args.message)}</p>
<table role="presentation" class="btn-table" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr><td align="center" bgcolor="${INDIGO}" style="border-radius:8px;">
<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 32px;font-family:${FONT};font-size:15px;line-height:22px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(args.buttonLabel)}</a>
</td></tr>
</table>
<p style="margin:24px 0 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};word-break:break-all;">If the button doesn't work, copy and paste this link into your browser:<br><a href="${url}" target="_blank" rel="noopener" style="color:${INDIGO_DARK};text-decoration:underline;">${url}</a></p>
${args.expiryNote ? `<p style="margin:20px 0 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">${escapeHtml(args.expiryNote)}</p>` : ""}
<p style="margin:12px 0 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">${escapeHtml(args.securityNote)}</p>
${args.supportNote ? `<p style="margin:12px 0 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">${escapeHtml(args.supportNote)}</p>` : ""}
</td></tr>
<tr><td align="center" style="padding:0 44px 32px 44px;">
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">&copy; ${year} Inventory Management System</p>
<p style="margin:4px 0 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">Automated message &mdash; please do not reply.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Sending routes                                                      */
/* ------------------------------------------------------------------ */

async function sendViaSmtp(args: {
  to: string;
  subject: string;
  text: string;
  html?: string;
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
    const attachment = args.html ? logoAttachment() : null;
    await transport.sendMail({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
      attachments: attachment ? [attachment] : undefined,
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
  html?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from =
    process.env.EMAIL_FROM?.trim() ||
    "Inventory Management System <onboarding@resend.dev>";
  try {
    const attachment = args.html ? logoAttachment() : null;
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
        html: args.html,
        // Resend's API has no CID field: the logo ships as a regular
        // attachment here, so clients that block remote images still
        // show the layout with its alt text.
        attachments: attachment
          ? [
              {
                filename: attachment.filename,
                content: attachment.content.toString("base64"),
              },
            ]
          : undefined,
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
  html?: string;
}): Promise<boolean> {
  if (smtpConfigured()) return sendViaSmtp(args);
  if (process.env.RESEND_API_KEY?.trim()) return sendViaResend(args);
  return false;
}

/* ------------------------------------------------------------------ */
/* Templates (same signatures as before — callers unchanged)          */
/* ------------------------------------------------------------------ */

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string,
): Promise<boolean> {
  // NOTE: verification tokens live 24 hours (see createEmailToken in
  // server/helpers.ts). The notice below states the real TTL; a
  // 1-hour notice would be false for this token type.
  const html = emailHtml({
    preheader: "Verify your email address to activate your account.",
    heading: "Verify your email address",
    supporting: "You're almost ready to get started!",
    message:
      "Thank you for creating an account with Inventory Management System. Please verify your email address to activate your account and keep it secure.",
    buttonLabel: "Verify Email Address",
    buttonUrl: verifyUrl,
    expiryNote:
      "This verification link expires in 24 hours and can only be used once.",
    securityNote:
      "If you didn't create this account, you can safely ignore this email.",
  });
  return sendMail({
    to,
    subject: "Verify Your Email Address — Inventory Management System",
    text: [
      "Welcome to the Inventory Management System.",
      "",
      "Please verify your email address to activate your store owner account:",
      verifyUrl,
      "",
      "This link expires in 24 hours. If you did not create this account, you can ignore this email.",
    ].join("\n"),
    html,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<boolean> {
  const html = emailHtml({
    preheader: "Reset the password for your Inventory Management System account.",
    heading: "Reset your password",
    supporting: "Let's help you get back into your account.",
    message:
      "We received a request to reset the password for your Inventory Management System account.",
    buttonLabel: "Reset Password",
    buttonUrl: resetUrl,
    expiryNote: "This link expires in 1 hour and can only be used once.",
    securityNote:
      "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
  });
  return sendMail({
    to,
    subject: "Reset Your Password — Inventory Management System",
    text: [
      "A password reset was requested for your Inventory Management System account.",
      "",
      "Set a new password here:",
      resetUrl,
      "",
      "This link expires in 1 hour and can be used once. If you did not request it, you can ignore this email.",
    ].join("\n"),
    html,
  });
}

export async function sendWelcomeEmail(
  to: string,
  loginUrl: string,
): Promise<boolean> {
  // Sent exactly once, from the verify route after the account is
  // activated. No token and no expiry: the button is the permanent
  // sign-in page, so there is nothing to expire, reuse, or fall back
  // to — and no password, token, or secret appears in the email.
  const html = emailHtml({
    preheader:
      "Welcome to Inventory Management System — your store account is now active.",
    heading: "Welcome to Inventory Management System!",
    supporting: "Your store, your inventory, your business.",
    message:
      "Welcome aboard! We're excited to have you as part of Inventory Management System. Your email is verified and your account is now active. You can now explore your dashboard and start managing everything in one convenient place.",
    buttonLabel: "Go to My Dashboard",
    buttonUrl: loginUrl,
    securityNote:
      "If you didn't create this account, you can safely ignore this email.",
    supportNote:
      "Need help? Send feedback from inside your dashboard — our team replies there.",
  });
  return sendMail({
    to,
    subject: "Welcome to Inventory Management System — Let's Get Started!",
    text: [
      "Welcome to Inventory Management System!",
      "",
      "Your store, your inventory, your business.",
      "",
      "Hi there,",
      "",
      "Welcome aboard! We're excited to have you as part of Inventory Management System. Your email is verified and your account is now active. You can now explore your dashboard and start managing everything in one convenient place.",
      "",
      "Go to My Dashboard:",
      loginUrl,
      "",
      "If you didn't create this account, you can safely ignore this email.",
      "",
      "Need help? Send feedback from inside your dashboard — our team replies there.",
    ].join("\n"),
    html,
  });
}
