import { describe, expect, it } from "vitest";

import { structureFrenchTransmission } from "../src/transmission-structure.js";

describe("structureFrenchTransmission", () => {
  it("sépare faits observés, rapportés et informations non mesurées", () => {
    const result = structureFrenchTransmission(
      "Tension 12/8 observée. La patiente dit avoir mal, EVA 6 sur 10. Température non mesurée. Pansement réalisé selon protocole.",
      new Date("2026-08-13T08:00:00.000Z"),
    );
    expect(result.vitals).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "tension", value: 120, value2: 80, source: "observed" }),
      expect.objectContaining({ type: "eva", value: 6, source: "reported" }),
    ]));
    expect(result.observations.map(({ source }) => source)).toEqual(expect.arrayContaining(["observed", "reported", "not_measured"]));
    expect(result.missingInfo).toEqual(["Température non mesurée"]);
    expect(result.vitals.some(({ type }) => type === "temperature")).toBe(false);
  });
});
