import type { EncryptedValue, OrganizationRole, PatientInput, PatientPatch } from "@idel-os/shared";
import { DomainError, patientInputSchema, patientPatchSchema } from "@idel-os/shared";
import type { EncryptionService } from "@idel-os/db";
import { buildAuditRecord } from "@idel-os/db";

export type StoredPatient = {
  id: string;
  organizationId: string;
  firstNameEnc: EncryptedValue;
  lastNameEnc: EncryptedValue;
  birthDateEnc: EncryptedValue;
  phoneEnc: EncryptedValue | null;
  emailEnc: EncryptedValue | null;
  notesEnc: EncryptedValue | null;
  addressLineEnc: EncryptedValue;
  postalCode: string;
  city: string;
  accessNotesEnc: EncryptedValue | null;
  mobility: PatientInput["mobility"];
  isAld: boolean;
  aldDetailsEnc: EncryptedValue | null;
  isDiabetic: boolean;
  isActive: boolean;
};

export type PatientView = PatientInput & { id: string; isActive: boolean };

export interface PatientRepository {
  create(patient: StoredPatient): Promise<void>;
  findById(organizationId: string, patientId: string): Promise<StoredPatient | null>;
  update(patient: StoredPatient): Promise<void>;
}

export interface AuditSink {
  append(record: ReturnType<typeof buildAuditRecord> & { organizationId: string }): Promise<void>;
}

type Actor = { userId: string; role: OrganizationRole };

export class PatientService {
  public constructor(
    private readonly repository: PatientRepository,
    private readonly audit: AuditSink,
    private readonly encryption: EncryptionService,
  ) {}

  public async create(command: {
    organizationId: string;
    actor: Actor;
    patientId: string;
    input: PatientInput;
  }): Promise<PatientView> {
    const input = patientInputSchema.parse(command.input);
    const stored = await this.encrypt(command.organizationId, command.patientId, input, true);
    await this.repository.create(stored);
    await this.writeAudit(command.organizationId, command.actor, "patient.created", command.patientId, null, input);
    return { id: command.patientId, ...input, isActive: true };
  }

  public async get(organizationId: string, patientId: string): Promise<PatientView> {
    const stored = await this.repository.findById(organizationId, patientId);
    if (stored === null) {
      throw new DomainError("PATIENT_NOT_FOUND", "Patient introuvable.");
    }
    return this.decrypt(stored);
  }

  public async update(command: {
    organizationId: string;
    actor: Actor;
    patientId: string;
    patch: PatientPatch;
  }): Promise<PatientView> {
    const patch = patientPatchSchema.parse(command.patch);
    const before = await this.get(command.organizationId, command.patientId);
    const isActive = before.isActive;
    const beforeInput = patientInputSchema.parse(before);
    const merged = patientInputSchema.parse({ ...beforeInput, ...patch });
    const stored = await this.encrypt(command.organizationId, command.patientId, merged, isActive);
    await this.repository.update(stored);
    await this.writeAudit(command.organizationId, command.actor, "patient.updated", command.patientId, before, merged);
    return { id: command.patientId, ...merged, isActive };
  }

  public async deactivate(
    organizationId: string,
    patientId: string,
    actor: Actor,
  ): Promise<void> {
    const before = await this.get(organizationId, patientId);
    const stored = await this.repository.findById(organizationId, patientId);
    if (stored === null) throw new DomainError("PATIENT_NOT_FOUND", "Patient introuvable.");
    await this.repository.update({ ...stored, isActive: false });
    await this.writeAudit(organizationId, actor, "patient.deactivated", patientId, before, {
      ...before,
      isActive: false,
    });
  }

  private async encrypt(
    organizationId: string,
    id: string,
    input: PatientInput,
    isActive: boolean,
  ): Promise<StoredPatient> {
    const optional = async (value: string | null): Promise<EncryptedValue | null> =>
      value === null ? null : this.encryption.encrypt(organizationId, value);
    return {
      id,
      organizationId,
      firstNameEnc: await this.encryption.encrypt(organizationId, input.firstName),
      lastNameEnc: await this.encryption.encrypt(organizationId, input.lastName),
      birthDateEnc: await this.encryption.encrypt(organizationId, input.birthDate),
      phoneEnc: await optional(input.phone),
      emailEnc: await optional(input.email),
      notesEnc: await optional(input.notes),
      addressLineEnc: await this.encryption.encrypt(organizationId, input.addressLine),
      postalCode: input.postalCode,
      city: input.city,
      accessNotesEnc: await optional(input.accessNotes),
      mobility: input.mobility,
      isAld: input.isAld,
      aldDetailsEnc: await optional(input.aldDetails),
      isDiabetic: input.isDiabetic,
      isActive,
    };
  }

  private async decrypt(patient: StoredPatient): Promise<PatientView> {
    const optional = async (value: EncryptedValue | null): Promise<string | null> =>
      value === null ? null : this.encryption.decrypt(patient.organizationId, value);
    return {
      id: patient.id,
      firstName: await this.encryption.decrypt(patient.organizationId, patient.firstNameEnc),
      lastName: await this.encryption.decrypt(patient.organizationId, patient.lastNameEnc),
      birthDate: await this.encryption.decrypt(patient.organizationId, patient.birthDateEnc),
      phone: await optional(patient.phoneEnc),
      email: await optional(patient.emailEnc),
      notes: await optional(patient.notesEnc),
      addressLine: await this.encryption.decrypt(patient.organizationId, patient.addressLineEnc),
      postalCode: patient.postalCode,
      city: patient.city,
      accessNotes: await optional(patient.accessNotesEnc),
      mobility: patient.mobility,
      isAld: patient.isAld,
      aldDetails: await optional(patient.aldDetailsEnc),
      isDiabetic: patient.isDiabetic,
      isActive: patient.isActive,
    };
  }

  private async writeAudit(
    organizationId: string,
    actor: Actor,
    action: string,
    patientId: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await this.audit.append({
      organizationId,
      ...buildAuditRecord({
        actorUserId: actor.userId,
        actorRole: actor.role,
        action,
        resourceType: "patient",
        resourceId: patientId,
        before,
        after,
        aiProposalId: null,
        ip: null,
        userAgent: null,
      }),
    });
  }
}
