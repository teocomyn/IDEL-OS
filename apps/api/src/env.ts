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
  DATA_MODE: z.enum(["synthetic", "health"]).default("synthetic"),
  HDS_PROVIDER: z.string().min(1).optional(),
  HDS_CERTIFICATE_REFERENCE: z.string().min(1).optional(),
  HDS_REGION: z.string().min(1).optional(),
  OSRM_URL: z.url().default("http://127.0.0.1:5000"),
  VROOM_URL: z.url().default("http://127.0.0.1:3002"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
});

export type ApiEnvironment = z.infer<typeof envSchema>;

export function parseEnvironment(source: NodeJS.ProcessEnv): ApiEnvironment {
  const environment = envSchema.parse(source);
  if (environment.NODE_ENV === "production") {
    const key = Buffer.from(environment.IDEL_MASTER_KEY_BASE64, "base64");
    if (key.length !== 32) throw new Error("IDEL_MASTER_KEY_BASE64 must decode to 32 bytes.");
    if (environment.DATA_MODE === "health") {
      const missing = (["HDS_PROVIDER", "HDS_CERTIFICATE_REFERENCE", "HDS_REGION"] as const)
        .filter((name) => environment[name] === undefined);
      if (missing.length > 0) {
        throw new Error(`Production health mode requires: ${missing.join(", ")}.`);
      }
      if (environment.WEB_ORIGIN.includes("vercel.app")) {
        throw new Error("Le traitement de données de santé est interdit sur le déploiement Vercel public.");
      }
      if (environment.OSRM_URL.startsWith("https://router.project-osrm.org")) {
        throw new Error("Le routage de santé doit utiliser l’instance OSRM auto-hébergée.");
      }
    }
  }
  return environment;
}
