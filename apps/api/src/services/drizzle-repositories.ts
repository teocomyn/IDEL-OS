import { and, eq } from "drizzle-orm";

import {
  auditLog,
  patients,
  type Database,
  withOrganization,
} from "@idel-os/db";
import type { EncryptedValue } from "@idel-os/shared";

import type { AuditSink, PatientRepository, StoredPatient } from "./patient-service.js";

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
