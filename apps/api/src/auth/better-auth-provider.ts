import { eq } from "drizzle-orm";

import { sessions, type Database } from "@idel-os/db";

import type { AuthProvider, AuthenticatedProfessional } from "./auth-provider.js";
import type { BetterAuthInstance } from "./better-auth.js";

export class BetterAuthProvider implements AuthProvider {
  public constructor(
    private readonly auth: BetterAuthInstance,
    private readonly database: Database,
  ) {}

  public async getProfessional(headers: Headers): Promise<AuthenticatedProfessional | null> {
    const result = await this.auth.api.getSession({ headers });
    if (
      result === null ||
      result.user.orgId === null ||
      result.user.orgId === undefined ||
      result.user.isActive !== true ||
      result.user.twoFactorEnabled !== true
    ) {
      return null;
    }
    if (!isRole(result.user.role)) return null;
    return {
      userId: result.user.id,
      organizationId: result.user.orgId,
      role: result.user.role,
      twoFactorVerified: true,
    };
  }

  public async revokeUserSessions(userId: string): Promise<void> {
    await this.database.delete(sessions).where(eq(sessions.userId, userId));
  }
}

function isRole(value: unknown): value is AuthenticatedProfessional["role"] {
  return typeof value === "string" && ["owner", "idel", "remplacant", "secretaire"].includes(value);
}
