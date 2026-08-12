import { describe, expect, it } from "vitest";

import { professionalIdentitySchema } from "../src/auth/identity-number.js";

describe("professionalIdentitySchema", () => {
  it("accepts a format-valid RPPS", () => {
    expect(
      professionalIdentitySchema.parse({ rpps: "10001234567", adeli: null }),
    ).toEqual({ rpps: "10001234567", adeli: null });
  });

  it("accepts a format-valid ADELI when RPPS is unavailable", () => {
    expect(professionalIdentitySchema.parse({ rpps: null, adeli: "751234567" })).toEqual({
      rpps: null,
      adeli: "751234567",
    });
  });

  it("requires at least one professional identifier", () => {
    expect(() => professionalIdentitySchema.parse({ rpps: null, adeli: null })).toThrow();
  });

  it("rejects malformed identifiers", () => {
    expect(() =>
      professionalIdentitySchema.parse({ rpps: "1000-123", adeli: null }),
    ).toThrow();
  });
});
