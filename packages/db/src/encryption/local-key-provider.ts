import { hkdfSync } from "node:crypto";

import type { KeyProvider, OrganizationKey } from "./key-provider.js";

export class LocalKeyProvider implements KeyProvider {
  public constructor(private readonly masterKey: Buffer) {
    if (masterKey.length !== 32) {
      throw new Error("The local master key must contain exactly 32 bytes.");
    }
  }

  public async getOrganizationKey(
    organizationId: string,
    keyId = "local-v1",
  ): Promise<OrganizationKey> {
    const key = Buffer.from(
      hkdfSync("sha256", this.masterKey, Buffer.from(organizationId), Buffer.from(keyId), 32),
    );
    return { keyId, key };
  }
}
