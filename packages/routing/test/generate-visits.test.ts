import type { CarePlanScheduleInput } from "@idel-os/shared";
import { describe, expect, it } from "vitest";

import { generateVisitSchedule } from "../src/index.js";

function dailyInput(overrides: Partial<CarePlanScheduleInput> = {}): CarePlanScheduleInput {
  return {
    patientId: "patient-demo",
    startDate: "2026-08-13",
    endDate: "2026-08-15",
    items: [{
      id: "pansement",
      label: "Pansement fictif",
      estimatedDurationMin: 20,
      frequency: {
        kind: "daily",
        timesPerDay: 1,
        everyNDays: 1,
        timeWindows: [{ start: "07:00", end: "09:00" }],
      },
    }],
    ...overrides,
  };
}

describe("generateVisitSchedule", () => {
  it("génère les dates de début et de fin incluses", () => {
    expect(generateVisitSchedule(dailyInput()).map(({ date }) => date)).toEqual([
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
    ]);
  });

  it("génère plusieurs passages quotidiens dans l’ordre", () => {
    const input = dailyInput({
      items: [{
        id: "traitement",
        label: "Traitement fictif",
        estimatedDurationMin: 10,
        frequency: {
          kind: "daily",
          timesPerDay: 2,
          everyNDays: 1,
          timeWindows: [
            { start: "17:00", end: "19:00" },
            { start: "06:30", end: "08:30" },
          ],
        },
      }],
    });
    expect(generateVisitSchedule(input).map(({ timeWindow }) => timeWindow.start)).toEqual([
      "06:30", "17:00", "06:30", "17:00", "06:30", "17:00",
    ]);
  });

  it("respecte un intervalle d’un jour sur deux", () => {
    const input = dailyInput({ endDate: "2026-08-18" });
    const item = input.items[0];
    if (item?.frequency.kind !== "daily") throw new Error("Fréquence de test invalide.");
    item.frequency.everyNDays = 2;
    expect(generateVisitSchedule(input).map(({ date }) => date)).toEqual([
      "2026-08-13", "2026-08-15", "2026-08-17",
    ]);
  });

  it("respecte les jours de semaine sélectionnés", () => {
    const input = dailyInput({
      startDate: "2026-08-10",
      endDate: "2026-08-16",
      items: [{
        id: "hebdomadaire",
        label: "Soin hebdomadaire fictif",
        estimatedDurationMin: 15,
        frequency: {
          kind: "weekly",
          weekdays: [5, 1, 5],
          timeWindow: { start: "10:00", end: "11:00" },
        },
      }],
    });
    expect(generateVisitSchedule(input).map(({ date }) => date)).toEqual([
      "2026-08-10", "2026-08-14",
    ]);
  });

  it("ne planifie pas les soins à la demande", () => {
    const input = dailyInput({
      items: [{
        id: "si-besoin",
        label: "Soin fictif si besoin",
        estimatedDurationMin: 10,
        frequency: { kind: "as_needed", instructions: "Selon prescription fictive" },
      }],
    });
    expect(generateVisitSchedule(input)).toEqual([]);
  });

  it("fusionne plusieurs soins dans une chronologie stable", () => {
    const input = dailyInput();
    input.items.push({
      id: "soir",
      label: "Passage fictif du soir",
      estimatedDurationMin: 10,
      frequency: {
        kind: "daily",
        timesPerDay: 1,
        everyNDays: 1,
        timeWindows: [{ start: "18:00", end: "20:00" }],
      },
    });
    const visits = generateVisitSchedule(input);
    expect(visits).toHaveLength(6);
    expect(visits.slice(0, 2).map(({ careItems }) => careItems[0]?.id)).toEqual(["pansement", "soir"]);
  });

  it("regroupe dans un passage les soins dont les fenêtres se chevauchent", () => {
    const input = dailyInput({ endDate: "2026-08-13" });
    input.items.push({
      id: "matin",
      label: "Second soin fictif du matin",
      estimatedDurationMin: 10,
      frequency: {
        kind: "daily",
        timesPerDay: 1,
        everyNDays: 1,
        timeWindows: [{ start: "06:30", end: "08:30" }],
      },
    });
    const visits = generateVisitSchedule(input);
    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({
      timeWindow: { start: "07:00", end: "08:30" },
      estimatedDurationMin: 30,
    });
    expect(visits[0]?.careItems.map(({ id }) => id)).toEqual(["matin", "pansement"]);
  });

  it("refuse un horizon supérieur à un an", () => {
    expect(() => generateVisitSchedule(dailyInput({ endDate: "2027-08-15" }))).toThrow(
      "limitée à 366 jours",
    );
  });
});
