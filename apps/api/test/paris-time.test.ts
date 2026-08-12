import { describe, expect, it } from "vitest";

import { parisDayBounds, parisTimeOnInstantDay } from "../src/services/paris-time.js";

describe("horaires Europe/Paris", () => {
  it("utilise l'heure d'été pour une journée terrain d'août", () => {
    expect(parisDayBounds("2026-08-13")).toEqual({
      start: new Date("2026-08-12T22:00:00.000Z"),
      end: new Date("2026-08-13T22:00:00.000Z"),
    });
    expect(parisTimeOnInstantDay(new Date("2026-08-13T06:30:00.000Z"), "09:15:00"))
      .toEqual(new Date("2026-08-13T07:15:00.000Z"));
  });

  it("utilise l'heure d'hiver pour une journée terrain de janvier", () => {
    expect(parisDayBounds("2026-01-13")).toEqual({
      start: new Date("2026-01-12T23:00:00.000Z"),
      end: new Date("2026-01-13T23:00:00.000Z"),
    });
  });
});
