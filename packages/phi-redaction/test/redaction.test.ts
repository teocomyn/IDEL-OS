import { describe, expect, it } from "vitest";

import { assertNoObviousPhi, isRedactedPayload, redactForAi } from "../src/index.js";

describe("pseudonymisation avant IA", () => {
  it("remplace les identités explicites et identifiants usuels dans tout l'objet", () => {
    const result = redactForAi(
      {
        note: "Emma Martin appelle le 06 12 34 56 78.",
        nested: { email: "emma@example.fr", repeated: "Emma Martin" },
      },
      [{ kind: "PATIENT", value: "Emma Martin" }],
    );

    expect(result.payload.data).toEqual({
      note: "[PATIENT_1] appelle le [PHONE_1].",
      nested: { email: "[EMAIL_1]", repeated: "[PATIENT_1]" },
    });
    expect(result.vault).toHaveLength(3);
    expect(isRedactedPayload(result.payload)).toBe(true);
    expect(() => assertNoObviousPhi(result.payload.data)).not.toThrow();
  });

  it("refuse un payload contenant encore un NIR", () => {
    expect(() => assertNoObviousPhi({ text: "1 84 12 75 123 456 78" })).toThrow("NIR");
  });
});
