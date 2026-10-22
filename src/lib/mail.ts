/**
 * Transactional email (verification + password reset).
 *
 * Sends through the Resend API when RESEND_API_KEY is configured
 * (EMAIL_FROM overrides the sender; otherwise Resend's onboarding sender
 * is used, which can only deliver to the Resend account owner's inbox).
 *
 * When no mailer is configured, sendMail returns false and the callers
 * fall back to showing the link ON SCREEN (setup mode) — the flows must
 * work end-to-end either way, because the platform operator may not have
 * connected an email provider yet.
 */

export function mailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
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

export async function sendMail(args: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;
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
