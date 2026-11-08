import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/server/db";
import { seedDefaultStatuses } from "@/server/jobs/statuses";
import { emailConfigured, sendEmail } from "@/server/email";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const socialProviders = {
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
      }
    : {}),
};

const firstName = (name: string) => name.split(" ")[0] || "there";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Email must be confirmed before signing in, once an email transport is configured.
    requireEmailVerification: emailConfigured,
    // Forgot password: a one-hour link; resetting signs the account out everywhere.
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Trackr password",
        text: `Hi ${firstName(user.name)},

Someone asked to reset the password for this account. If that was you, choose a new password here (the link works for one hour):
${url}

If it wasn't you, ignore this email; your password stays the same.`,
        link: url,
      });
    },
  },
  emailVerification: emailConfigured
    ? {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
          await sendEmail({
            to: user.email,
            subject: "Confirm your email for Trackr",
            text: `Hi ${firstName(user.name)},

Confirm your email to start using Trackr:
${url}

If you didn't sign up, ignore this email.`,
            link: url,
          });
        },
      }
    : undefined,
  socialProviders,
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "user", input: false },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (u) => ({
          data: {
            ...u,
            role: adminEmails.includes(u.email.toLowerCase())
              ? "admin"
              : "user",
          },
        }),
        after: async (u) => {
          await seedDefaultStatuses(u.id);
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
