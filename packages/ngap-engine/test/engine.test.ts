import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  NgapConfigurationError,
  NgapInputError,
  createNgapEngine,
  defaultRuleset,
  evaluate,
} from "../src/index.js";
import type { CodingContext, CodingResult } from "../src/index.js";

type ScenarioOverrides = {
  patient?: Partial<CodingContext["patient"]>;
  visit?: Partial<CodingContext["visit"]>;
  acts?: CodingContext["acts"];
  travel?: Partial<CodingContext["travel"]>;
  history?: Partial<CodingContext["history"]>;
  date?: string;
};

type Scenario = {
  id: string;
  description: string;
  input: ScenarioOverrides;
  expected: {
    totalCents?: number;
    alertCodes?: string[];
    absentAlertCodes?: string[];
    lineRates?: number[];
    errorCode?: string;
  };
};

const scenariosDirectory = join(import.meta.dirname, "cases");
const scenarios = readdirSync(scenariosDirectory)
  .filter((fileName) => fileName.endsWith(".json"))
  .sort()
  .map((fileName) =>
    JSON.parse(readFileSync(join(scenariosDirectory, fileName), "utf8")) as Scenario,
  );

function buildContext(overrides: ScenarioOverrides): CodingContext {
  const date = new Date(overrides.date ?? "2026-08-12T08:00:00.000Z");
  return {
    patient: {
      isALD: false,
      isDiabetic: false,
      age: 42,
      ...overrides.patient,
    },
    visit: {
      at: date,
      isSunday: false,
      isHoliday: false,
      isNight: false,
      isHomeVisit: false,
      ...overrides.visit,
    },
    acts: overrides.acts ?? [
      { catalogId: "pansement-non-chirurgical", quantity: 1, tags: [] },
    ],
    travel: {
      fromCabinetKm: 0,
      zone: "plaine",
      isFirstOfTour: true,
      ...overrides.travel,
    },
    history: {
      sameDayVisits: [],
      seriesProgress: {},
      ...overrides.history,
    },
    date,
  };
}

function assertResult(result: CodingResult, scenario: Scenario): void {
  const { expected } = scenario;
  if (expected.totalCents !== undefined) {
    expect(result.totalCents).toBe(expected.totalCents);
  }
  if (expected.alertCodes !== undefined) {
    expect(result.alerts.map(({ code }) => code)).toEqual(
      expect.arrayContaining(expected.alertCodes),
    );
  }
  if (expected.absentAlertCodes !== undefined) {
    expect(result.alerts.map(({ code }) => code)).not.toEqual(
      expect.arrayContaining(expected.absentAlertCodes),
    );
  }
  if (expected.lineRates !== undefined) {
    expect(result.lines.filter(({ kind }) => kind === "act").map(({ appliedRate }) => appliedRate)).toEqual(
      expected.lineRates,
    );
  }
}

describe("NGAP business scenarios", () => {
  it("keeps the 40 reviewed scenarios as an explicit acceptance baseline", () => {
    expect(scenarios).toHaveLength(40);
  });

  for (const scenario of scenarios) {
    it(`${scenario.id} — ${scenario.description}`, () => {
      const context = buildContext(scenario.input);
      if (scenario.expected.errorCode !== undefined) {
        expect(() => evaluate(context)).toThrowError(NgapInputError);
        try {
          evaluate(context);
        } catch (error) {
          expect(error).toMatchObject({ code: scenario.expected.errorCode });
        }
        return;
      }

      assertResult(evaluate(context), scenario);
    });
  }
});

describe("production safety guard", () => {
  it("refuses to start in production while active rules remain TO_VERIFY", () => {
    expect(() => createNgapEngine({ environment: "production" })).toThrowError(
      NgapConfigurationError,
    );
  });

  it("starts in development and remains deterministic", () => {
    const engine = createNgapEngine({ environment: "development" });
    const context = buildContext({});
    expect(engine.evaluate(context)).toEqual(engine.evaluate(context));
  });

  it("exposes source metadata for every active rule, catalog act and tariff", () => {
    const sourcedEntries = [
      ...defaultRuleset.rules,
      ...defaultRuleset.catalog,
      ...defaultRuleset.tariffs,
    ];
    expect(sourcedEntries.length).toBeGreaterThan(0);
    expect(sourcedEntries.every(({ source }) => source.url !== "" && source.retrievedAt !== "")).toBe(
      true,
    );
  });
});
