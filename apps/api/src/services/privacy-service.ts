import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { PatientView } from "./patient-service.js";
import type { OrganizationRole } from "@idel-os/shared";

type PrivacyActor = { userId: string; role: OrganizationRole };

type PrivacyPatientSource = {
  get(organizationId: string, patientId: string): Promise<PatientView>;
  deactivate(organizationId: string, patientId: string, actor: PrivacyActor): Promise<void>;
};

export class PrivacyService {
  public constructor(private readonly patients: PrivacyPatientSource) {}

  public async exportJson(organizationId: string, patientId: string): Promise<Buffer> {
    const patient = await this.patients.get(organizationId, patientId);
    return Buffer.from(
      JSON.stringify({ formatVersion: 1, generatedAt: new Date().toISOString(), patient }, null, 2),
      "utf8",
    );
  }

  public async exportPdf(organizationId: string, patientId: string): Promise<Uint8Array> {
    const patient = await this.patients.get(organizationId, patientId);
    const document = await PDFDocument.create();
    const page = document.addPage([595.28, 841.89]);
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const left = 48;
    let y = 786;
    page.drawText("IDEL OS - Export des données patient", {
      x: left,
      y,
      size: 18,
      font: bold,
      color: rgb(0.06, 0.25, 0.29),
    });
    y -= 34;
    page.drawText("Document généré à la demande du responsable de traitement", {
      x: left,
      y,
      size: 10,
      font: regular,
      color: rgb(0.35, 0.4, 0.42),
    });
    y -= 42;
    const fields: ReadonlyArray<readonly [string, string]> = [
      ["Identifiant", patient.id],
      ["Nom", patient.lastName],
      ["Prénom", patient.firstName],
      ["Date de naissance", patient.birthDate],
      ["Adresse", `${patient.addressLine}, ${patient.postalCode} ${patient.city}`],
      ["Téléphone", patient.phone ?? "Non renseigné"],
      ["E-mail", patient.email ?? "Non renseigné"],
      ["Mobilité", patient.mobility],
      ["Dossier actif", patient.isActive ? "Oui" : "Non"],
    ];
    for (const [label, value] of fields) {
      page.drawText(label, { x: left, y, size: 10, font: bold });
      page.drawText(value, { x: 180, y, size: 10, font: regular });
      y -= 26;
    }
    page.drawText("Ce document contient des données sensibles. Conservez-le de manière sécurisée.", {
      x: left,
      y: 48,
      size: 9,
      font: regular,
      color: rgb(0.45, 0.15, 0.12),
    });
    return document.save();
  }

  public async requestErasure(
    organizationId: string,
    patientId: string,
    actor: PrivacyActor,
  ): Promise<void> {
    await this.patients.deactivate(organizationId, patientId, actor);
  }
}
