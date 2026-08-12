import { describe, expect, it } from "vitest";

import { redactForAi } from "@idel-os/phi-redaction";

import { FixtureAiProvider, SafeAiGateway } from "../src/index.js";

describe("passerelle IA sûre", () => {
  it("accepte uniquement le type pseudonymisé et expose la traçabilité", async () => {
    const gateway = new SafeAiGateway(new FixtureAiProvider({ acts: ["pansement"] }));
    const { payload } = redactForAi(
      { text: "Ordonnance de Louise Ambre" },
      [{ kind: "PATIENT", value: "Louise Ambre" }],
    );
    const result = await gateway.complete<typeof payload.data, { acts: string[] }>({
      purpose: "prescription_structure",
      promptVersion: "rx-v1",
      payload,
    });
    expect(result.output).toEqual({ acts: ["pansement"] });
    expect(result.model).toBe("fixture-no-network");
    expect(result.redactionCount).toBe(1);
  });

  it("refuse à l'exécution un objet forgé", async () => {
    const gateway = new SafeAiGateway(new FixtureAiProvider({}));
    await expect(gateway.complete({
      purpose: "prescription_structure",
      promptVersion: "rx-v1",
      payload: { data: { text: "06 12 34 56 78" } } as never,
    })).rejects.toThrow("non pseudonymisé");
  });
});
