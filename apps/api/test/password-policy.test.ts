import { describe, expect, it } from "vitest";

import { PasswordPolicy } from "../src/auth/password-policy.js";

describe("PasswordPolicy", () => {
  it("rejects passwords shorter than 12 characters", async () => {
    const policy = new PasswordPolicy(async () => false);
    await expect(policy.assertAllowed("Short123!")).rejects.toThrow("12 caractères");
  });

  it("rejects a compromised password", async () => {
    const policy = new PasswordPolicy(async () => true);
    await expect(policy.assertAllowed("Compromised123!")).rejects.toThrow("compromis");
  });

  it("accepts a sufficiently long non-compromised password", async () => {
    const policy = new PasswordPolicy(async () => false);
    await expect(policy.assertAllowed("Synthetic-Strong-Password-48!")).resolves.toBeUndefined();
  });
});
