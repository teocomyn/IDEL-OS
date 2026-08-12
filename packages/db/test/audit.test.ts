import { describe, expect, it } from "vitest";

import { buildAuditRecord, hashAuditState } from "../src/audit.js";

describe("audit records", () => {
  it("hashes canonical object state deterministically", () => {
    expect(hashAuditState({ b: 2, a: 1 })).toBe(hashAuditState({ a: 1, b: 2 }));
  });

  it("does not retain before or after state", () => {
    const record = buildAuditRecord({
      actorUserId: "0198f54c-4064-7000-8000-000000000003",
      actorRole: "idel",
      action: "patient.updated",
      resourceType: "patient",
      resourceId: "0198f54c-4064-7000-8000-000000000004",
      before: { value: "synthetic-before" },
      after: { value: "synthetic-after" },
      ip: null,
      userAgent: null,
      aiProposalId: null,
    });

    expect(record.beforeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(record.afterHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(record)).not.toContain("synthetic-before");
  });
});
