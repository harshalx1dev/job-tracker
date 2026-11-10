import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transactional email (password resets, sign-up confirmation).
 *
 * 1. SMTP via Nodemailer when SMTP_USER + SMTP_PASS are set. Defaults are Gmail
 *    (smtp.gmail.com:465); SMTP_PASS is a Gmail *app password*, not your login password.
 * 2. Resend when RESEND_API_KEY is set (needs a verified domain to email other people).
 * 3. Neither: development prints the link to the server console; production logs an error.
 */

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, ""); // Google shows app passwords with spaces
const resendKey = process.env.RESEND_API_KEY;

export const emailTransport: "smtp" | "resend" | "console" =
  smtpUser && smtpPass ? "smtp" : resendKey ? "resend" : "console";

/** True when real email can be sent (turns on required email verification). */
export const emailConfigured = emailTransport !== "console";

const from = () =>
  process.env.EMAIL_FROM ||
  (smtpUser ? `Trackr <${smtpUser}>` : "Trackr <onboarding@resend.dev>");

const g = globalThis as unknown as { __smtp?: Transporter };
function smtp() {
  if (!g.__smtp) {
    const port = Number(process.env.SMTP_PORT || 465);
    g.__smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: smtpUser!, pass: smtpPass! },
    });
  }
  return g.__smtp;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  link: string;
}) {
  // The reserved .test domain (RFC 2606) can never receive mail: test and e2e
  // accounts use it. Sending would only bounce back to the sender's inbox.
  if (/\.test$/i.test(opts.to.trim())) {
    if (process.env.NODE_ENV !== "production")
      console.info(`[email] not sent to test address ${opts.to}: ${opts.link}`);
    return;
  }
  try {
    if (emailTransport === "smtp") {
      await smtp().sendMail({
        from: from(),
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
      });
      return;
    }
    if (emailTransport === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: from(),
          to: opts.to,
          subject: opts.subject,
          text: opts.text,
        }),
      });
      if (!res.ok)
        throw new Error(
          `Resend ${res.status}: ${await res.text().catch(() => "")}`,
        );
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `\n[email] ${opts.subject} → ${opts.to}\n[email] ${opts.link}\n`,
      );
    } else {
      console.error(
        `[email] can't send "${opts.subject}": no SMTP_USER/SMTP_PASS or RESEND_API_KEY set`,
      );
    }
  } catch (err) {
    // Never leak details to the user (it would reveal whether the account exists); log for the admin.
    console.error(
      "[email] send failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
