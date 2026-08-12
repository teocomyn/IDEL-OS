import type { AuditSink, PatientRepository, StoredPatient } from "./patient-service.js";

export class InMemoryPatientRepository implements PatientRepository {
  private readonly patients = new Map<string, StoredPatient>();

  public async create(patient: StoredPatient): Promise<void> {
    this.patients.set(`${patient.organizationId}:${patient.id}`, structuredClone(patient));
  }

  public async findById(organizationId: string, patientId: string): Promise<StoredPatient | null> {
    const patient = this.patients.get(`${organizationId}:${patientId}`);
    return patient === undefined ? null : structuredClone(patient);
  }

  public async update(patient: StoredPatient): Promise<void> {
    this.patients.set(`${patient.organizationId}:${patient.id}`, structuredClone(patient));
  }
}

export class InMemoryAuditSink implements AuditSink {
  public readonly records: Array<Parameters<AuditSink["append"]>[0]> = [];

  public async append(record: Parameters<AuditSink["append"]>[0]): Promise<void> {
    this.records.push(structuredClone(record));
  }
}
