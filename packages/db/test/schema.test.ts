import { describe, expect, it } from "vitest";

import { encryptedColumns, organizationScopedTables } from "../src/schema/index.js";

describe("database security metadata", () => {
  it("declares every encrypted column with the _enc suffix", () => {
    expect(encryptedColumns.length).toBeGreaterThan(10);
    for (const column of encryptedColumns) {
      expect(column).toMatch(/_enc$/);
    }
  });

  it("declares every organization-scoped table once", () => {
    expect(organizationScopedTables.length).toBeGreaterThan(10);
    expect(new Set(organizationScopedTables).size).toBe(organizationScopedTables.length);
  });
});
