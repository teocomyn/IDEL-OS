import { describe, expect, it } from "vitest";

import { parseEnvironment } from "../src/env.js";

const base = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://example.test/idel",
  DATABASE_AUTH_URL: "postgres://example.test/auth",
  IDEL_MASTER_KEY_BASE64: Buffer.alloc(32, 1).toString("base64"),
  BETTER_AUTH_SECRET: "a-secure-test-secret-with-more-than-32-chars",
  BETTER_AUTH_URL: "https://api.example.test",
  WEB_ORIGIN: "https://app.example.test",
};

describe("frontière HDS de production", () => {
  it("laisse le site public en mode synthétique", () => {
    expect(parseEnvironment({ ...base, WEB_ORIGIN: "https://idel-os-web.vercel.app" }).DATA_MODE).toBe("synthetic");
  });

  it("refuse les données de santé sans preuve de périmètre HDS", () => {
    expect(() => parseEnvironment({ ...base, DATA_MODE: "health" })).toThrow("HDS_PROVIDER");
  });

  it("refuse explicitement le mode santé sur Vercel", () => {
    expect(() => parseEnvironment({
      ...base,
      DATA_MODE: "health",
      HDS_PROVIDER: "provider",
      HDS_CERTIFICATE_REFERENCE: "certificate-v2",
      HDS_REGION: "fr-par",
      WEB_ORIGIN: "https://idel-os-web.vercel.app",
    })).toThrow("interdit");
  });
});
