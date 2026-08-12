import type { AuditSink, PatientRepository, StoredPatient } from "./patient-service.js";
import type { StoredTransmission, TransmissionRepository } from "./transmission-service.js";

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

export class InMemoryTransmissionRepository implements TransmissionRepository {
  private readonly transmissions = new Map<string, StoredTransmission>();

  public async create(transmission: StoredTransmission): Promise<void> {
    this.transmissions.set(`${transmission.organizationId}:${transmission.id}`, structuredClone(transmission));
  }

  public async findById(organizationId: string, transmissionId: string): Promise<StoredTransmission | null> {
    const transmission = this.transmissions.get(`${organizationId}:${transmissionId}`);
    return transmission === undefined ? null : structuredClone(transmission);
  }

  public async listByPatient(organizationId: string, patientId: string): Promise<StoredTransmission[]> {
    return [...this.transmissions.values()]
      .filter((transmission) => transmission.organizationId === organizationId && transmission.patientId === patientId)
      .map((transmission) => structuredClone(transmission));
  }

  public async update(transmission: StoredTransmission): Promise<void> {
    this.transmissions.set(`${transmission.organizationId}:${transmission.id}`, structuredClone(transmission));
  }
}
