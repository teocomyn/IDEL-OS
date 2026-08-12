import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { EncryptionService } from "../src/encryption/encryption-service.js";
import { asEncryptedValue } from "../src/encryption/encrypted-value.js";
import { LocalKeyProvider } from "../src/encryption/local-key-provider.js";

const organizationA = "0198f54c-4064-7000-8000-000000000001";
const organizationB = "0198f54c-4064-7000-8000-000000000002";

describe("EncryptionService", () => {
  const service = new EncryptionService(new LocalKeyProvider(randomBytes(32)));

  it("round-trips a value for one organization", async () => {
    const encrypted = await service.encrypt(organizationA, "synthetic secret");
    await expect(service.decrypt(organizationA, encrypted)).resolves.toBe("synthetic secret");
  });

  it("uses a unique nonce for every encryption", async () => {
    const first = await service.encrypt(organizationA, "same value");
    const second = await service.encrypt(organizationA, "same value");
    expect(first).not.toBe(second);
  });

  it("binds ciphertext to its organization", async () => {
    const encrypted = await service.encrypt(organizationA, "synthetic secret");
    await expect(service.decrypt(organizationB, encrypted)).rejects.toThrow();
  });

  it("rejects modified ciphertext", async () => {
    const encrypted = await service.encrypt(organizationA, "synthetic secret");
    const parsed = JSON.parse(Buffer.from(encrypted, "base64url").toString("utf8")) as {
      ciphertext: string;
    };
    parsed.ciphertext = `${parsed.ciphertext.slice(0, -2)}AA`;
    const tampered = asEncryptedValue(Buffer.from(JSON.stringify(parsed)).toString("base64url"));
    await expect(service.decrypt(organizationA, tampered)).rejects.toThrow();
  });

  it("does not expose plaintext in its serialized format", async () => {
    const encrypted = await service.encrypt(organizationA, "synthetic secret");
    expect(encrypted).not.toContain("synthetic secret");
  });
});
