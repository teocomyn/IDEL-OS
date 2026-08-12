import type { AuditSink, PatientRepository, StoredPatient } from "./patient-service.js";
import type { StoredTransmission, TransmissionRepository } from "./transmission-service.js";
import type { CarePlanRepository, StoredCarePlanActivation } from "./care-plan-service.js";
import type { StoredVisitLifecycle, VisitLifecycleRepository } from "./visit-service.js";
import type { PrescriptionRepository, StoredPrescription } from "./prescription-service.js";
import type { FieldRepository, StoredTodayVisit, StoredVisitException } from "./field-service.js";
import type { DeviceRepository, MobileDevice } from "./device-service.js";

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

export class InMemoryCarePlanRepository implements CarePlanRepository {
  public readonly plans: StoredCarePlanActivation[] = [];
  public readonly validatedPrescriptions = new Set<string>();

  public async isValidatedPrescription(
    organizationId: string,
    prescriptionId: string,
    patientId: string,
  ): Promise<boolean> {
    return Promise.resolve(this.validatedPrescriptions.has(`${organizationId}:${prescriptionId}:${patientId}`));
  }

  public async activate(plan: StoredCarePlanActivation): Promise<void> {
    this.plans.push(structuredClone(plan));
    return Promise.resolve();
  }
}

export class InMemoryVisitLifecycleRepository implements VisitLifecycleRepository {
  public readonly visits = new Map<string, StoredVisitLifecycle>();

  public async findById(organizationId: string, visitId: string): Promise<StoredVisitLifecycle | null> {
    const visit = this.visits.get(`${organizationId}:${visitId}`);
    return Promise.resolve(visit === undefined ? null : structuredClone(visit));
  }

  public async updateVisit(visit: StoredVisitLifecycle): Promise<void> {
    this.visits.set(`${visit.organizationId}:${visit.id}`, structuredClone(visit));
    return Promise.resolve();
  }

  public async setActPerformed(organizationId: string, visitActId: string, performed: boolean): Promise<void> {
    for (const [key, visit] of this.visits) {
      if (!key.startsWith(`${organizationId}:`)) continue;
      const act = visit.acts.find(({ id }) => id === visitActId);
      if (act !== undefined) act.performed = performed;
    }
    return Promise.resolve();
  }
}

export class InMemoryPrescriptionRepository implements PrescriptionRepository {
  private readonly prescriptions = new Map<string, StoredPrescription>();

  public async create(prescription: StoredPrescription): Promise<void> {
    this.prescriptions.set(`${prescription.organizationId}:${prescription.id}`, structuredClone(prescription));
  }

  public async findById(organizationId: string, prescriptionId: string): Promise<StoredPrescription | null> {
    const prescription = this.prescriptions.get(`${organizationId}:${prescriptionId}`);
    return prescription === undefined ? null : structuredClone(prescription);
  }

  public async update(prescription: StoredPrescription): Promise<void> {
    this.prescriptions.set(`${prescription.organizationId}:${prescription.id}`, structuredClone(prescription));
  }
}

export class InMemoryFieldRepository implements FieldRepository {
  public readonly visits = new Map<string, StoredTodayVisit>();
  public readonly exceptions: StoredVisitException[] = [];

  public async listToday(_organizationId: string, assignedUserId: string, date: string): Promise<StoredTodayVisit[]> {
    return [...this.visits.values()].filter((visit) =>
      (visit.assignedUserId === null || visit.assignedUserId === assignedUserId)
      && visit.scheduledAt.toISOString().slice(0, 10) === date,
    ).map((visit) => structuredClone(visit));
  }

  public async findAssignedVisit(_organizationId: string, assignedUserId: string, visitId: string): Promise<StoredTodayVisit | null> {
    const visit = this.visits.get(visitId);
    return visit === undefined || (visit.assignedUserId !== null && visit.assignedUserId !== assignedUserId)
      ? null
      : structuredClone(visit);
  }

  public async recordException(exception: StoredVisitException): Promise<boolean> {
    if (this.exceptions.some(({ idempotencyKey }) => idempotencyKey === exception.idempotencyKey)) return false;
    this.exceptions.push(structuredClone(exception));
    const visit = this.visits.get(exception.visitId);
    if (visit !== undefined) {
      this.visits.set(exception.visitId, {
        ...visit,
        status: exception.resultingStatus,
        scheduledAt: exception.rescheduledAt ?? visit.scheduledAt,
      });
    }
    return true;
  }
}

export class InMemoryDeviceRepository implements DeviceRepository {
  public readonly devices = new Map<string, MobileDevice>();

  public async upsert(device: MobileDevice): Promise<void> {
    const existing = this.devices.get(device.id);
    this.devices.set(device.id, structuredClone(existing === undefined ? device : {
      ...device,
      wipeRequestedAt: existing.wipeRequestedAt,
      wipedAt: existing.wipedAt,
    }));
  }

  public async findById(organizationId: string, deviceId: string): Promise<MobileDevice | null> {
    const device = this.devices.get(deviceId);
    return device === undefined || device.organizationId !== organizationId ? null : structuredClone(device);
  }

  public async requestWipe(_organizationId: string, deviceId: string, requestedAt: Date): Promise<void> {
    const device = this.devices.get(deviceId);
    if (device !== undefined) this.devices.set(deviceId, { ...device, wipeRequestedAt: requestedAt });
  }

  public async acknowledgeWipe(_organizationId: string, deviceId: string, wipedAt: Date): Promise<void> {
    const device = this.devices.get(deviceId);
    if (device !== undefined) this.devices.set(deviceId, { ...device, wipedAt });
  }
}
