import { createHash } from "node:crypto";

import type { OrganizationRole } from "@idel-os/shared";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function hashAuditState(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export type AuditRecordInput = {
  actorUserId: string;
  actorRole: OrganizationRole;
  action: string;
  resourceType: string;
  resourceId: string;
  before: unknown;
  after: unknown;
  aiProposalId: string | null;
  ip: string | null;
  userAgent: string | null;
};

export function buildAuditRecord(input: AuditRecordInput) {
  return {
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    beforeHash: hashAuditState(input.before),
    afterHash: hashAuditState(input.after),
    aiProposalId: input.aiProposalId,
    ip: input.ip,
    userAgent: input.userAgent,
  } as const;
}
