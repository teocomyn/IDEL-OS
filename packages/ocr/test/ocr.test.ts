import { describe, expect, it } from "vitest";

import {
  assessCaptureQuality,
  assertExtractionFullyReviewed,
  normalizeExtraction,
} from "../src/index.js";

describe("qualité de capture", () => {
  it("bloque une photo floue et trop petite", () => {
    const result = assessCaptureQuality({
      mimeType: "image/jpeg",
      sizeBytes: 400_000,
      width: 800,
      height: 900,
      laplacianVariance: 20,
    });
    expect(result.accepted).toBe(false);
    expect(result.issues.map(({ code }) => code)).toEqual([
      "IMAGE_TOO_SMALL",
      "IMAGE_BLURRY",
    ]);
  });

  it("accepte un PDF dans la limite de taille", () => {
    expect(assessCaptureQuality({ mimeType: "application/pdf", sizeBytes: 900_000 })).toEqual({
      accepted: true,
      score: 100,
      issues: [],
    });
  });
});

describe("relecture OCR", () => {
  const extraction = normalizeExtraction({
    provider: "fixture",
    providerVersion: "1",
    rawText: "Pansement quotidien",
    fields: [
      {
        id: "act-1",
        path: "items.0.description",
        label: "Soin",
        value: "Pansement",
        confidence: 0.89,
        page: 1,
        sourceText: "Pansement quotidien",
        needsReview: false,
      },
    ],
  });

  it("publie une confiance par champ et force la relecture humaine", () => {
    expect(extraction.fields[0]?.needsReview).toBe(true);
    expect(extraction.overallConfidence).toBe(0.89);
    expect(extraction.requiresHumanReview).toBe(true);
  });

  it("refuse une validation sans confirmation de chaque champ", () => {
    expect(() => assertExtractionFullyReviewed(extraction, [])).toThrow("Relecture incomplète");
    expect(() => assertExtractionFullyReviewed(extraction, [
      { fieldId: "act-1", correctedValue: "Pansement", confirmed: true },
    ])).not.toThrow();
  });
});
