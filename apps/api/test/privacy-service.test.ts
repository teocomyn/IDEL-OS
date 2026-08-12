import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { PrivacyService } from "../src/services/privacy-service.js";

const syntheticPatient = {
  id: "0198f54c-4064-7000-8000-000000000220",
  firstName: "Patient-Synthétique-Bêta",
  lastName: "Fictif-Un",
  birthDate: "1980-02-02",
  phone: null,
  email: null,
  notes: null,
  addressLine: "2 avenue Imaginaire",
  postalCode: "00000",
  city: "Ville Fictive",
  accessNotes: null,
  mobility: "autonomous" as const,
  isAld: false,
  aldDetails: null,
  isDiabetic: false,
  isActive: true,
};

describe("PrivacyService", () => {
  const service = new PrivacyService({
    get: async () => syntheticPatient,
    deactivate: async () => undefined,
  });

  it("exports structured JSON", async () => {
    const exported = await service.exportJson("org", syntheticPatient.id);
    expect(JSON.parse(exported.toString("utf8"))).toMatchObject({
      formatVersion: 1,
      patient: { firstName: syntheticPatient.firstName },
    });
  });

  it("exports a valid one-page PDF", async () => {
    const bytes = await service.exportPdf("org", syntheticPatient.id);
    expect(Buffer.from(bytes).subarray(0, 4).toString("ascii")).toBe("%PDF");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
  });

  it("uses a reviewed deactivation workflow for erasure", async () => {
    let deactivated = false;
    const erasureService = new PrivacyService({
      get: async () => syntheticPatient,
      deactivate: async () => {
        deactivated = true;
      },
    });
    await erasureService.requestErasure("org", syntheticPatient.id, {
      userId: "0198f54c-4064-7000-8000-000000000221",
      role: "owner",
    });
    expect(deactivated).toBe(true);
  });
});
