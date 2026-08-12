import type { Database } from "@idel-os/db";
import {
  accounts,
  memberships,
  organizations,
  sessions,
  twoFactors,
  users,
  verifications,
} from "@idel-os/db";
import { professionalIdentitySchema } from "@idel-os/shared";
import { eq } from "drizzle-orm";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { haveIBeenPwned, twoFactor } from "better-auth/plugins";

export type EmailMessage = { to: string; subject: string; text: string };
export type EmailSender = (message: EmailMessage) => Promise<void>;

export function createBetterAuth(options: {
  database: Database;
  secret: string;
  baseUrl: string;
  trustedOrigins: string[];
  sendEmail: EmailSender;
}) {
  return betterAuth({
    appName: "IDEL OS",
    baseURL: options.baseUrl,
    secret: options.secret,
    trustedOrigins: options.trustedOrigins,
    advanced: { database: { generateId: "uuid" } },
    database: drizzleAdapter(options.database, {
      provider: "pg",
      schema: {
        user: users,
        account: accounts,
        session: sessions,
        verification: verifications,
        twoFactor: twoFactors,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await options.sendEmail({
          to: user.email,
          subject: "Réinitialisation de votre mot de passe IDEL OS",
          text: `Ouvrez ce lien sécurisé pour choisir un nouveau mot de passe : ${url}`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await options.sendEmail({
          to: user.email,
          subject: "Vérifiez votre adresse e-mail IDEL OS",
          text: `Confirmez votre adresse en ouvrant ce lien : ${url}`,
        });
      },
    },
    user: {
      additionalFields: {
        orgId: { type: "string", required: false, input: false },
        firstName: { type: "string", required: true, input: true },
        lastName: { type: "string", required: true, input: true },
        rpps: { type: "string", required: false, input: true },
        adeli: { type: "string", required: false, input: true },
        phone: { type: "string", required: false, input: true },
        role: { type: "string", required: false, input: false, defaultValue: "idel" },
        isActive: { type: "boolean", required: false, input: false, defaultValue: true },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            professionalIdentitySchema.parse({
              rpps: typeof user.rpps === "string" ? user.rpps : null,
              adeli: typeof user.adeli === "string" ? user.adeli : null,
            });
          },
          after: async (user) => {
            await options.database.transaction(async (transaction) => {
              const [organization] = await transaction
                .insert(organizations)
                .values({ name: `Cabinet de ${user.name}`, type: "solo" })
                .returning({ id: organizations.id });
              if (organization === undefined) throw new Error("Organization creation failed.");
              await transaction
                .update(users)
                .set({ orgId: organization.id, role: "owner" })
                .where(eq(users.id, user.id));
              await transaction.insert(memberships).values({
                orgId: organization.id,
                userId: user.id,
                role: "owner",
              });
            });
          },
        },
      },
    },
    plugins: [
      expo(),
      haveIBeenPwned(),
      twoFactor({
        issuer: "IDEL OS",
      }),
    ],
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
