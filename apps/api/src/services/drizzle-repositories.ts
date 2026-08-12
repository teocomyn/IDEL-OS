import { and, eq } from "drizzle-orm";

import {
  auditLog,
  carePlanItems,
  carePlans,
  patients,
  prescriptions,
  transmissions,
  visitActs,
  visits,
  type Database,
  withOrganization,
} from "@idel-os/db";
import type { EncryptedValue } from "@idel-os/shared";

import type { AuditSink, PatientRepository, StoredPatient } from "./patient-service.js";
import type { StoredTransmission, TransmissionRepository } from "./transmission-service.js";
import type { CarePlanRepository, StoredCarePlanActivation } from "./care-plan-service.js";
import type { StoredVisitLifecycle, VisitLifecycleRepository } from "./visit-service.js";

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
        .where(and(eq(transmissions.orgId, organizationId), eq(transmissions.patientId, patientId)));
      return rows.map(fromDatabaseTransmission);
    });
  }

  public async update(transmission: StoredTransmission): Promise<void> {
    await withOrganization(this.database, transmission.organizationId, async (transaction) => {
      await transaction
        .update(transmissions)
        .set({ status: transmission.status, validatedAt: transmission.validatedAt })
        .where(and(eq(transmissions.orgId, transmission.organizationId), eq(transmissions.id, transmission.id)));
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
    rawTranscriptEnc: transmission.rawTranscriptEnc,
    structuredJsonEnc: transmission.structuredJsonEnc,
    finalTextEnc: transmission.finalTextEnc,
    status: transmission.status,
    validatedAt: transmission.validatedAt,
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
    rawTranscriptEnc: transmission.rawTranscriptEnc as EncryptedValue,
    structuredJsonEnc: transmission.structuredJsonEnc as EncryptedValue,
    finalTextEnc: transmission.finalTextEnc as EncryptedValue,
    status: transmission.status,
    validatedAt: transmission.validatedAt,
  };
}
