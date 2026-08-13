import { describe, expect, it } from "vitest";

import { structuredTransmissionSchema } from "../src/index.js";

describe("structuredTransmissionSchema", () => {
  it("accepts a professional structured handover", () => {
    const parsed = structuredTransmissionSchema.parse({
      actsPerformed: [{ label: "Pansement synthétique", conformToProtocol: true }],
      observations: [{ text: "Rougeur fictive observée", source: "observed" }],
      vitals: [{
        type: "eva",
        value: 3,
        value2: null,
        unit: "/10",
        source: "observed",
        measuredAt: "2026-08-13T08:00:00.000Z",
      }],
      concerns: [{ text: "À surveiller au prochain passage", urgency: "a_surveiller" }],
      nextVisitNotes: "Prévoir le matériel synthétique.",
      missingInfo: [],
    });
    expect(parsed.vitals[0]?.type).toBe("eva");
  });

  it("rejects an invalid pain value shape and unbounded content", () => {
    expect(() => structuredTransmissionSchema.parse({
      actsPerformed: [],
      observations: [],
      vitals: [{ type: "unknown", value: Number.NaN, value2: null, unit: "" }],
      concerns: [],
      nextVisitNotes: null,
      missingInfo: [],
    })).toThrow();
  });
});
