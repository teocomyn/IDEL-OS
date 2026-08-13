import { and, asc, eq, gte, isNull, lt, or } from "drizzle-orm";

import {
  auditLog,
  actCatalog,
  carePlanItems,
  carePlans,
  patients,
  mobileDevices,
  prescriptions,
  prescriptionItems,
  transmissions,
  transmissionReceipts,
  vitalSigns,
  visitActs,
  visitExceptions,
  visits,
  type Database,
  withOrganization,
} from "@idel-os/db";
import type { EncryptedValue } from "@idel-os/shared";

import type { AuditSink, PatientRepository, StoredPatient } from "./patient-service.js";
import type { StoredTransmission, StoredTransmissionReceipt, TransmissionRepository } from "./transmission-service.js";
import type { StructuredTransmission } from "@idel-os/shared";
import type { CarePlanRepository, StoredCarePlanActivation } from "./care-plan-service.js";
import type { StoredVisitLifecycle, VisitLifecycleRepository } from "./visit-service.js";
import type { PrescriptionRepository, StoredPrescription } from "./prescription-service.js";
import type { FieldRepository, StoredTodayVisit, StoredVisitException } from "./field-service.js";
import type { DeviceRepository, MobileDevice } from "./device-service.js";
import { parisDayBounds } from "./paris-time.js";

export class DrizzlePatientRepository implements PatientRepository {
  public constructor(private readonly database: Database) {}

  public async create(patient: StoredPatient): Promise<void> {
    await withOrganization(this.database, patient.organizationId, async (transaction) => {
      await transaction.insert(patients).values(toDatabasePatient(patient));
    });
  }

  public async findById(organizationId: string, patientId: string): Promise<StoredPatient | null> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [patient] = await transaction
        .select()
        .from(patients)
        .where(and(eq(patients.orgId, organizationId), eq(patients.id, patientId)))
        .limit(1);
      return patient === undefined ? null : fromDatabasePatient(patient);
    });
  }

  public async update(patient: StoredPatient): Promise<void> {
    await withOrganization(this.database, patient.organizationId, async (transaction) => {
      await transaction
        .update(patients)
        .set({ ...toDatabasePatient(patient), updatedAt: new Date() })
        .where(and(eq(patients.orgId, patient.organizationId), eq(patients.id, patient.id)));
    });
  }
}

export class DrizzleAuditSink implements AuditSink {
  public constructor(private readonly database: Database) {}

  public async append(record: Parameters<AuditSink["append"]>[0]): Promise<void> {
    await withOrganization(this.database, record.organizationId, async (transaction) => {
      await transaction.insert(auditLog).values({
        orgId: record.organizationId,
        actorUserId: record.actorUserId,
        actorRole: record.actorRole,
        action: record.action,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        beforeHash: record.beforeHash,
        afterHash: record.afterHash,
        aiProposalId: record.aiProposalId,
        ip: record.ip,
        userAgent: record.userAgent,
      });
    });
  }
}

export class DrizzleTransmissionRepository implements TransmissionRepository {
  public constructor(private readonly database: Database) {}

  public async create(transmission: StoredTransmission): Promise<void> {
    await withOrganization(this.database, transmission.organizationId, async (transaction) => {
      await transaction.insert(transmissions).values(toDatabaseTransmission(transmission));
    });
  }

  public async findById(organizationId: string, transmissionId: string): Promise<StoredTransmission | null> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [transmission] = await transaction
        .select()
        .from(transmissions)
        .where(and(eq(transmissions.orgId, organizationId), eq(transmissions.id, transmissionId)))
        .limit(1);
      return transmission === undefined ? null : fromDatabaseTransmission(transmission);
    });
  }

  public async listByPatient(organizationId: string, patientId: string): Promise<StoredTransmission[]> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const rows = await transaction
        .select()
        .from(transmissions)
        .where(and(eq(transmissions.orgId, organizationId), eq(transmissions.patientId, patientId)))
        .orderBy(asc(transmissions.createdAt));
      return rows.map(fromDatabaseTransmission);
    });
  }

  public async listValidatedForDate(organizationId: string, assignedUserId: string, date: string): Promise<StoredTransmission[]> {
    const { start, end } = parisDayBounds(date);
    return withOrganization(this.database, organizationId, async (transaction) => {
      const rows = await transaction.select({ transmission: transmissions })
        .from(transmissions)
        .innerJoin(visits, and(eq(visits.orgId, organizationId), eq(visits.id, transmissions.visitId)))
        .where(and(
          eq(transmissions.orgId, organizationId),
          eq(transmissions.status, "validated"),
          gte(visits.scheduledAt, start),
          lt(visits.scheduledAt, end),
          or(eq(visits.assignedUserId, assignedUserId), isNull(visits.assignedUserId)),
        ))
        .orderBy(asc(visits.scheduledAt), asc(transmissions.createdAt));
      return rows.map(({ transmission }) => fromDatabaseTransmission(transmission));
    });
  }

  public async validateAndSaveVitals(transmission: StoredTransmission, structured: StructuredTransmission): Promise<void> {
    await withOrganization(this.database, transmission.organizationId, async (transaction) => {
      await transaction
        .update(transmissions)
        .set({ status: transmission.status, validatedAt: transmission.validatedAt, validatedByUserId: transmission.validatedByUserId })
        .where(and(eq(transmissions.orgId, transmission.organizationId), eq(transmissions.id, transmission.id)));
      if (structured.vitals.length > 0) {
        await transaction.insert(vitalSigns).values(structured.vitals.map((vital) => ({
          orgId: transmission.organizationId,
          patientId: transmission.patientId,
          visitId: transmission.visitId,
          type: vital.type,
          value: String(vital.value),
          value2: vital.value2 === null ? null : String(vital.value2),
          unit: vital.unit,
          measuredAt: new Date(vital.measuredAt),
          source: vital.source === "reported" ? "voice_reported" : "voice_observed",
        })));
      }
    });
  }

  public async upsertReceipt(receipt: StoredTransmissionReceipt): Promise<void> {
    await withOrganization(this.database, receipt.organizationId, async (transaction) => {
      await transaction.insert(transmissionReceipts).values({
        orgId: receipt.organizationId,
        transmissionId: receipt.transmissionId,
        userId: receipt.userId,
        readAt: receipt.readAt,
        acknowledgedAt: receipt.acknowledgedAt,
      }).onConflictDoUpdate({
        target: [transmissionReceipts.transmissionId, transmissionReceipts.userId],
        set: { readAt: receipt.readAt, acknowledgedAt: receipt.acknowledgedAt },
      });
    });
  }

  public async findReceipt(organizationId: string, transmissionId: string, userId: string): Promise<StoredTransmissionReceipt | null> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [receipt] = await transaction.select().from(transmissionReceipts).where(and(
        eq(transmissionReceipts.orgId, organizationId),
        eq(transmissionReceipts.transmissionId, transmissionId),
        eq(transmissionReceipts.userId, userId),
      )).limit(1);
      return receipt === undefined ? null : {
        organizationId: receipt.orgId,
        transmissionId: receipt.transmissionId,
        userId: receipt.userId,
        readAt: receipt.readAt,
        acknowledgedAt: receipt.acknowledgedAt,
      };
    });
  }
}

export class DrizzleCarePlanRepository implements CarePlanRepository {
  public constructor(private readonly database: Database) {}

  public async isValidatedPrescription(
    organizationId: string,
    prescriptionId: string,
    patientId: string,
  ): Promise<boolean> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [prescription] = await transaction
        .select({ id: prescriptions.id })
        .from(prescriptions)
        .where(and(
          eq(prescriptions.orgId, organizationId),
          eq(prescriptions.id, prescriptionId),
          eq(prescriptions.patientId, patientId),
          eq(prescriptions.status, "validated"),
        ))
        .limit(1);
      return prescription !== undefined;
    });
  }

  public async activate(plan: StoredCarePlanActivation): Promise<void> {
    await withOrganization(this.database, plan.organizationId, async (transaction) => {
      await transaction.insert(carePlans).values({
        id: plan.carePlanId,
        orgId: plan.organizationId,
        patientId: plan.patientId,
        prescriptionId: plan.prescriptionId,
        name: plan.name,
        status: "active",
        startsAt: plan.startDate,
        endsAt: plan.endDate,
      });
      await transaction.insert(carePlanItems).values(plan.items.map((item) => ({
        id: item.id,
        orgId: plan.organizationId,
        carePlanId: plan.carePlanId,
        prescriptionItemId: item.prescriptionItemId,
        actCatalogId: item.actCatalogId,
        estimatedDurationMin: item.estimatedDurationMin,
        requiresTwoNurses: item.requiresTwoNurses,
      })));
      if (plan.visits.length > 0) {
        await transaction.insert(visits).values(plan.visits.map((visit) => ({
          id: visit.id,
          orgId: plan.organizationId,
          patientId: visit.patientId,
          carePlanId: visit.carePlanId,
          scheduledAt: visit.scheduledAt,
          timeWindowStart: visit.timeWindowStart,
          timeWindowEnd: visit.timeWindowEnd,
          estimatedDurationMin: visit.estimatedDurationMin,
          status: "planned" as const,
        })));
        const actCatalogByItem = new Map(plan.items.map((item) => [item.id, item.actCatalogId]));
        const plannedActs = plan.visits.flatMap((visit) => visit.carePlanItemIds.map((carePlanItemId) => {
          const actCatalogId = actCatalogByItem.get(carePlanItemId);
          if (actCatalogId === undefined) throw new Error("Acte de plan de soins introuvable.");
          return {
            orgId: plan.organizationId,
            visitId: visit.id,
            carePlanItemId,
            actCatalogId,
            performed: false,
          };
        }));
        if (plannedActs.length > 0) await transaction.insert(visitActs).values(plannedActs);
      }
    });
  }
}

export class DrizzleVisitLifecycleRepository implements VisitLifecycleRepository {
  public constructor(private readonly database: Database) {}

  public async findById(organizationId: string, visitId: string): Promise<StoredVisitLifecycle | null> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [visit] = await transaction
        .select()
        .from(visits)
        .where(and(eq(visits.orgId, organizationId), eq(visits.id, visitId)))
        .limit(1);
      if (visit === undefined) return null;
      const acts = await transaction
        .select({ id: visitActs.id, performed: visitActs.performed })
        .from(visitActs)
        .where(and(eq(visitActs.orgId, organizationId), eq(visitActs.visitId, visitId)));
      return {
        id: visit.id,
        organizationId: visit.orgId,
        patientId: visit.patientId,
        assignedUserId: visit.assignedUserId,
        status: visit.status,
        startedAt: visit.startedAt,
        endedAt: visit.endedAt,
        acts,
      };
    });
  }

  public async updateVisit(visit: StoredVisitLifecycle): Promise<void> {
    await withOrganization(this.database, visit.organizationId, async (transaction) => {
      await transaction
        .update(visits)
        .set({ status: visit.status, startedAt: visit.startedAt, endedAt: visit.endedAt })
        .where(and(eq(visits.orgId, visit.organizationId), eq(visits.id, visit.id)));
    });
  }

  public async setActPerformed(organizationId: string, visitActId: string, performed: boolean): Promise<void> {
    await withOrganization(this.database, organizationId, async (transaction) => {
      await transaction
        .update(visitActs)
        .set({ performed })
        .where(and(eq(visitActs.orgId, organizationId), eq(visitActs.id, visitActId)));
    });
  }
}

type PrescriptionExtractionEnvelope = Pick<StoredPrescription, "extraction" | "captureQuality" | "reviews">;

export class DrizzlePrescriptionRepository implements PrescriptionRepository {
  public constructor(private readonly database: Database) {}

  public async create(prescription: StoredPrescription): Promise<void> {
    await withOrganization(this.database, prescription.organizationId, async (transaction) => {
      await transaction.insert(prescriptions).values({
        id: prescription.id,
        orgId: prescription.organizationId,
        patientId: prescription.patientId,
        source: prescription.source,
        originalFileUrl: prescription.objectKey,
        prescribedAt: prescription.prescribedAt,
        validFrom: prescription.validFrom,
        validUntil: prescription.validUntil,
        isRenewal: prescription.isRenewal,
        rawOcrTextEnc: prescription.rawOcrTextEnc,
        extractionJson: toExtractionEnvelope(prescription),
        extractionConfidence: String(prescription.extractionConfidence),
        status: prescription.status,
      });
      await transaction.insert(prescriptionItems).values(prescription.items.map((item) => ({
        id: item.id,
        orgId: prescription.organizationId,
        prescriptionId: prescription.id,
        rawText: item.rawText,
        actType: item.actType,
        description: item.description,
        frequencyJson: item.frequency,
        durationDays: item.durationDays,
        startDate: item.startDate,
        endDate: item.endDate,
        constraintsJson: item.constraints,
        extractionConfidence: String(item.extractionConfidence),
        needsReview: true,
      })));
    });
  }

  public async findById(organizationId: string, prescriptionId: string): Promise<StoredPrescription | null> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [prescription] = await transaction
        .select()
        .from(prescriptions)
        .where(and(eq(prescriptions.orgId, organizationId), eq(prescriptions.id, prescriptionId)))
        .limit(1);
      if (prescription === undefined || prescription.rawOcrTextEnc === null || prescription.originalFileUrl === null) {
        return null;
      }
      const items = await transaction
        .select()
        .from(prescriptionItems)
        .where(and(
          eq(prescriptionItems.orgId, organizationId),
          eq(prescriptionItems.prescriptionId, prescriptionId),
        ));
      const envelope = prescription.extractionJson as PrescriptionExtractionEnvelope;
      return {
        id: prescription.id,
        organizationId: prescription.orgId,
        patientId: prescription.patientId,
        source: prescription.source,
        objectKey: prescription.originalFileUrl,
        prescribedAt: prescription.prescribedAt,
        validFrom: prescription.validFrom,
        validUntil: prescription.validUntil,
        isRenewal: prescription.isRenewal,
        rawOcrTextEnc: prescription.rawOcrTextEnc as EncryptedValue,
        extraction: envelope.extraction,
        captureQuality: envelope.captureQuality,
        extractionConfidence: Number(prescription.extractionConfidence ?? 0),
        status: prescription.status,
        validatedByUserId: prescription.validatedByUserId,
        validatedAt: prescription.validatedAt,
        reviews: envelope.reviews,
        items: items.map((item) => ({
          id: item.id,
          rawText: item.rawText,
          actType: item.actType,
          description: item.description,
          frequency: item.frequencyJson as Record<string, unknown>,
          durationDays: item.durationDays,
          startDate: item.startDate,
          endDate: item.endDate,
          constraints: item.constraintsJson as Record<string, unknown>,
          extractionConfidence: Number(item.extractionConfidence ?? 0),
        })),
      };
    });
  }

  public async update(prescription: StoredPrescription): Promise<void> {
    await withOrganization(this.database, prescription.organizationId, async (transaction) => {
      await transaction
        .update(prescriptions)
        .set({
          status: prescription.status,
          validatedByUserId: prescription.validatedByUserId,
          validatedAt: prescription.validatedAt,
          extractionJson: toExtractionEnvelope(prescription),
        })
        .where(and(
          eq(prescriptions.orgId, prescription.organizationId),
          eq(prescriptions.id, prescription.id),
        ));
      for (const item of prescription.items) {
        await transaction
          .update(prescriptionItems)
          .set({ needsReview: prescription.status !== "validated" })
          .where(and(
            eq(prescriptionItems.orgId, prescription.organizationId),
            eq(prescriptionItems.id, item.id),
          ));
      }
    });
  }
}

export class DrizzleFieldRepository implements FieldRepository {
  public constructor(private readonly database: Database) {}

  public async listToday(
    organizationId: string,
    assignedUserId: string,
    date: string,
  ): Promise<StoredTodayVisit[]> {
    const { start, end } = parisDayBounds(date);
    return withOrganization(this.database, organizationId, async (transaction) => {
      const rows = await transaction
        .select({ visit: visits, patient: patients })
        .from(visits)
        .innerJoin(patients, and(eq(patients.orgId, organizationId), eq(patients.id, visits.patientId)))
        .where(and(
          eq(visits.orgId, organizationId),
          gte(visits.scheduledAt, start),
          lt(visits.scheduledAt, end),
          or(eq(visits.assignedUserId, assignedUserId), isNull(visits.assignedUserId)),
        ))
        .orderBy(asc(visits.positionInTour), asc(visits.scheduledAt));
      return Promise.all(rows.map(async ({ visit, patient }) => {
        const acts = await transaction
          .select({ id: visitActs.id, performed: visitActs.performed, label: actCatalog.label })
          .from(visitActs)
          .leftJoin(actCatalog, eq(actCatalog.id, visitActs.actCatalogId))
          .where(and(eq(visitActs.orgId, organizationId), eq(visitActs.visitId, visit.id)));
        return toStoredTodayVisit(visit, patient, acts);
      }));
    });
  }

  public async findAssignedVisit(
    organizationId: string,
    assignedUserId: string,
    visitId: string,
  ): Promise<StoredTodayVisit | null> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [row] = await transaction
        .select({ visit: visits, patient: patients })
        .from(visits)
        .innerJoin(patients, and(eq(patients.orgId, organizationId), eq(patients.id, visits.patientId)))
        .where(and(
          eq(visits.orgId, organizationId),
          eq(visits.id, visitId),
          or(eq(visits.assignedUserId, assignedUserId), isNull(visits.assignedUserId)),
        ))
        .limit(1);
      if (row === undefined) return null;
      const acts = await transaction
        .select({ id: visitActs.id, performed: visitActs.performed, label: actCatalog.label })
        .from(visitActs)
        .leftJoin(actCatalog, eq(actCatalog.id, visitActs.actCatalogId))
        .where(and(eq(visitActs.orgId, organizationId), eq(visitActs.visitId, visitId)));
      return toStoredTodayVisit(row.visit, row.patient, acts);
    });
  }

  public async recordException(exception: StoredVisitException): Promise<boolean> {
    return withOrganization(this.database, exception.organizationId, async (transaction) => {
      const inserted = await transaction.insert(visitExceptions).values({
        orgId: exception.organizationId,
        visitId: exception.visitId,
        recordedByUserId: exception.recordedByUserId,
        idempotencyKey: exception.idempotencyKey,
        type: exception.type,
        noteEnc: exception.noteEnc,
        previousScheduledAt: exception.previousScheduledAt,
        rescheduledAt: exception.rescheduledAt,
      }).onConflictDoNothing({
        target: [visitExceptions.orgId, visitExceptions.idempotencyKey],
      }).returning({ id: visitExceptions.id });
      if (inserted.length === 0) return false;
      await transaction.update(visits).set({
        status: exception.resultingStatus,
        ...(exception.rescheduledAt === null ? {} : { scheduledAt: exception.rescheduledAt }),
      }).where(and(eq(visits.orgId, exception.organizationId), eq(visits.id, exception.visitId)));
      return true;
    });
  }
}

export class DrizzleDeviceRepository implements DeviceRepository {
  public constructor(private readonly database: Database) {}

  public async upsert(device: MobileDevice): Promise<void> {
    await withOrganization(this.database, device.organizationId, async (transaction) => {
      await transaction.insert(mobileDevices).values({
        id: device.id,
        orgId: device.organizationId,
        userId: device.userId,
        label: device.label,
        platform: device.platform,
        biometricEnabled: device.biometricEnabled,
        lastSeenAt: new Date(),
      }).onConflictDoUpdate({
        target: mobileDevices.id,
        set: {
          label: device.label,
          platform: device.platform,
          biometricEnabled: device.biometricEnabled,
          lastSeenAt: new Date(),
        },
      });
    });
  }

  public async findById(organizationId: string, deviceId: string): Promise<MobileDevice | null> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [device] = await transaction.select().from(mobileDevices).where(and(
        eq(mobileDevices.orgId, organizationId),
        eq(mobileDevices.id, deviceId),
      )).limit(1);
      return device === undefined ? null : {
        id: device.id,
        organizationId: device.orgId,
        userId: device.userId,
        label: device.label,
        platform: device.platform === "ios" ? "ios" : "android",
        biometricEnabled: device.biometricEnabled,
        wipeRequestedAt: device.wipeRequestedAt,
        wipedAt: device.wipedAt,
      };
    });
  }

  public async requestWipe(organizationId: string, deviceId: string, requestedAt: Date): Promise<void> {
    await withOrganization(this.database, organizationId, async (transaction) => {
      await transaction.update(mobileDevices).set({ wipeRequestedAt: requestedAt }).where(and(
        eq(mobileDevices.orgId, organizationId),
        eq(mobileDevices.id, deviceId),
      ));
    });
  }

  public async acknowledgeWipe(organizationId: string, deviceId: string, wipedAt: Date): Promise<void> {
    await withOrganization(this.database, organizationId, async (transaction) => {
      await transaction.update(mobileDevices).set({ wipedAt }).where(and(
        eq(mobileDevices.orgId, organizationId),
        eq(mobileDevices.id, deviceId),
      ));
    });
  }
}

function toStoredTodayVisit(
  visit: typeof visits.$inferSelect,
  patient: typeof patients.$inferSelect,
  acts: Array<{ id: string; performed: boolean; label: string | null }>,
): StoredTodayVisit {
  return {
    id: visit.id,
    patientId: visit.patientId,
    assignedUserId: visit.assignedUserId,
    scheduledAt: visit.scheduledAt,
    timeWindowStart: visit.timeWindowStart,
    timeWindowEnd: visit.timeWindowEnd,
    estimatedDurationMin: visit.estimatedDurationMin,
    status: visit.status,
    positionInTour: visit.positionInTour,
    firstNameEnc: patient.firstNameEnc as EncryptedValue,
    lastNameEnc: patient.lastNameEnc as EncryptedValue,
    addressLineEnc: patient.addressLineEnc as EncryptedValue,
    postalCode: patient.postalCode,
    city: patient.city,
    geo: patient.geo,
    acts: acts.map((act) => ({ id: act.id, performed: act.performed, label: act.label ?? "Acte de soins" })),
  };
}

function toExtractionEnvelope(
  prescription: StoredPrescription,
): PrescriptionExtractionEnvelope {
  return {
    extraction: prescription.extraction,
    captureQuality: prescription.captureQuality,
    reviews: prescription.reviews,
  };
}

function toDatabasePatient(patient: StoredPatient) {
  return {
    id: patient.id,
    orgId: patient.organizationId,
    firstNameEnc: patient.firstNameEnc,
    lastNameEnc: patient.lastNameEnc,
    birthDateEnc: patient.birthDateEnc,
    phoneEnc: patient.phoneEnc,
    emailEnc: patient.emailEnc,
    notesEnc: patient.notesEnc,
    addressLineEnc: patient.addressLineEnc,
    postalCode: patient.postalCode,
    city: patient.city,
    accessNotesEnc: patient.accessNotesEnc,
    mobility: patient.mobility,
    isAld: patient.isAld,
    aldDetailsEnc: patient.aldDetailsEnc,
    isDiabetic: patient.isDiabetic,
    isActive: patient.isActive,
  };
}

function fromDatabasePatient(patient: typeof patients.$inferSelect): StoredPatient {
  return {
    id: patient.id,
    organizationId: patient.orgId,
    firstNameEnc: patient.firstNameEnc as EncryptedValue,
    lastNameEnc: patient.lastNameEnc as EncryptedValue,
    birthDateEnc: patient.birthDateEnc as EncryptedValue,
    phoneEnc: patient.phoneEnc as EncryptedValue | null,
    emailEnc: patient.emailEnc as EncryptedValue | null,
    notesEnc: patient.notesEnc as EncryptedValue | null,
    addressLineEnc: patient.addressLineEnc as EncryptedValue,
    postalCode: patient.postalCode,
    city: patient.city,
    accessNotesEnc: patient.accessNotesEnc as EncryptedValue | null,
    mobility: patient.mobility,
    isAld: patient.isAld,
    aldDetailsEnc: patient.aldDetailsEnc as EncryptedValue | null,
    isDiabetic: patient.isDiabetic,
    isActive: patient.isActive,
  };
}

function toDatabaseTransmission(transmission: StoredTransmission) {
  return {
    id: transmission.id,
    orgId: transmission.organizationId,
    visitId: transmission.visitId,
    patientId: transmission.patientId,
    authorUserId: transmission.authorUserId,
    audioUrl: transmission.audioObjectKey,
    audioDurationS: transmission.audioDurationS,
    transcriptionMode: transmission.transcriptionMode,
    rawTranscriptEnc: transmission.rawTranscriptEnc,
    structuredJsonEnc: transmission.structuredJsonEnc,
    finalTextEnc: transmission.finalTextEnc,
    status: transmission.status,
    validatedAt: transmission.validatedAt,
    validatedByUserId: transmission.validatedByUserId,
    createdAt: transmission.createdAt,
  };
}

function fromDatabaseTransmission(transmission: typeof transmissions.$inferSelect): StoredTransmission {
  if (
    transmission.rawTranscriptEnc === null ||
    transmission.structuredJsonEnc === null ||
    transmission.finalTextEnc === null
  ) {
    throw new Error("Transmission chiffrée incomplète.");
  }
  return {
    id: transmission.id,
    organizationId: transmission.orgId,
    visitId: transmission.visitId,
    patientId: transmission.patientId,
    authorUserId: transmission.authorUserId,
    audioObjectKey: transmission.audioUrl,
    audioDurationS: transmission.audioDurationS,
    transcriptionMode: transmission.transcriptionMode === "on_device" || transmission.transcriptionMode === "hds_server" ? transmission.transcriptionMode : "manual",
    rawTranscriptEnc: transmission.rawTranscriptEnc as EncryptedValue,
    structuredJsonEnc: transmission.structuredJsonEnc as EncryptedValue,
    finalTextEnc: transmission.finalTextEnc as EncryptedValue,
    status: transmission.status,
    validatedAt: transmission.validatedAt,
    validatedByUserId: transmission.validatedByUserId,
    createdAt: transmission.createdAt,
  };
}
