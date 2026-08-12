import { describe, expect, it } from "vitest";

import { containsSensitiveData, sanitizeLogContext } from "../src/sensitive-log.js";

describe("sensitive log protection", () => {
  it("removes forbidden keys recursively", () => {
    const sanitized = sanitizeLogContext({
      requestId: "req_01",
      patient: {
        firstName: "SyntheticName",
        nir: "299019999999999",
      },
    });

    expect(sanitized).toEqual({ requestId: "req_01", patient: "[REDACTED]" });
  });

  it("detects email, phone and NIR-shaped values", () => {
    expect(containsSensitiveData("synthetic.person@example.test")).toBe(true);
    expect(containsSensitiveData("06 00 00 00 00")).toBe(true);
    expect(containsSensitiveData("299019999999999")).toBe(true);
    expect(containsSensitiveData("request req_01 completed")).toBe(false);
  });
});
