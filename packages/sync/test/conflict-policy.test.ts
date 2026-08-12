import { describe, expect, it } from "vitest";

import { resolveConflict } from "../src/conflict-policy.js";

describe("resolveConflict", () => {
  it("uses the newest version for mutable scalar resources", () => {
    expect(
      resolveConflict({ resource: "patient", localVersion: 3, serverVersion: 4 }),
    ).toBe("server");
    expect(resolveConflict({ resource: "visit", localVersion: 5, serverVersion: 4 })).toBe(
      "local",
    );
  });

  it("requires a new version for validated immutable resources", () => {
    expect(
      resolveConflict({ resource: "coding", localVersion: 3, serverVersion: 3, validated: true }),
    ).toBe("create_version");
  });
});
