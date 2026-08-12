import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { EncryptedValue } from "@idel-os/shared";

import { asEncryptedValue } from "./encrypted-value.js";
import type { KeyProvider } from "./key-provider.js";

type Envelope = {
  version: 1;
  keyId: string;
  iv: string;
  ciphertext: string;
  tag: string;
};

function parseEnvelope(value: EncryptedValue): Envelope {
  const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !("version" in parsed) ||
    parsed.version !== 1 ||
    !("keyId" in parsed) ||
    typeof parsed.keyId !== "string" ||
    !("iv" in parsed) ||
    typeof parsed.iv !== "string" ||
    !("ciphertext" in parsed) ||
    typeof parsed.ciphertext !== "string" ||
    !("tag" in parsed) ||
    typeof parsed.tag !== "string"
  ) {
    throw new Error("Invalid encrypted value envelope.");
  }
  return parsed as Envelope;
}

export class EncryptionService {
  public constructor(private readonly keyProvider: KeyProvider) {}

  public async encrypt(organizationId: string, plaintext: string): Promise<EncryptedValue> {
    const { key, keyId } = await this.keyProvider.getOrganizationKey(organizationId);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(organizationId));
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const envelope: Envelope = {
      version: 1,
      keyId,
      iv: iv.toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url"),
    };
    key.fill(0);
    return asEncryptedValue(Buffer.from(JSON.stringify(envelope)).toString("base64url"));
  }

  public async decrypt(organizationId: string, value: EncryptedValue): Promise<string> {
    const envelope = parseEnvelope(value);
    const { key } = await this.keyProvider.getOrganizationKey(organizationId, envelope.keyId);
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
      decipher.setAAD(Buffer.from(organizationId));
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } finally {
      key.fill(0);
    }
  }
}
