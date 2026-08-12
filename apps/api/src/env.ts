import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  DATABASE_ADMIN_URL: z.url().optional(),
  DATABASE_AUTH_URL: z.url(),
  IDEL_MASTER_KEY_BASE64: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  WEB_ORIGIN: z.url(),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
});

export type ApiEnvironment = z.infer<typeof envSchema>;

export function parseEnvironment(source: NodeJS.ProcessEnv): ApiEnvironment {
  const environment = envSchema.parse(source);
  if (environment.NODE_ENV === "production") {
    const key = Buffer.from(environment.IDEL_MASTER_KEY_BASE64, "base64");
    if (key.length !== 32) throw new Error("IDEL_MASTER_KEY_BASE64 must decode to 32 bytes.");
  }
  return environment;
}
