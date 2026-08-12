import { buildAuditRecord } from "@idel-os/db";
import { DomainError, type OrganizationRole } from "@idel-os/shared";

import type { AuditSink } from "./patient-service.js";

type Actor = { userId: string; role: OrganizationRole };

export type MobileDevice = {
  id: string;
  organizationId: string;
  userId: string;
  label: string;
  platform: "ios" | "android";
  biometricEnabled: boolean;
  wipeRequestedAt: Date | null;
  wipedAt: Date | null;
};

export interface DeviceRepository {
  upsert(device: MobileDevice): Promise<void>;
  findById(organizationId: string, deviceId: string): Promise<MobileDevice | null>;
  requestWipe(organizationId: string, deviceId: string, requestedAt: Date): Promise<void>;
  acknowledgeWipe(organizationId: string, deviceId: string, wipedAt: Date): Promise<void>;
}

export class DeviceService {
  public constructor(
    private readonly repository: DeviceRepository,
    private readonly audit: AuditSink,
    private readonly now: () => Date = () => new Date(),
    private readonly revokeUserSessions: (userId: string) => Promise<void> = () => Promise.resolve(),
  ) {}

  public async register(command: { organizationId: string; actor: Actor; device: Omit<MobileDevice, "organizationId" | "userId" | "wipeRequestedAt" | "wipedAt"> }) {
    if (command.actor.role === "secretaire") throw new DomainError("DEVICE_FORBIDDEN", "Accès terrain interdit.");
    await this.repository.upsert({
      ...command.device,
      organizationId: command.organizationId,
      userId: command.actor.userId,
      wipeRequestedAt: null,
      wipedAt: null,
    });
    return { deviceId: command.device.id, wipeRequested: false };
  }

  public async status(organizationId: string, actor: Actor, deviceId: string) {
    const device = await this.repository.findById(organizationId, deviceId);
    if (device === null || (device.userId !== actor.userId && actor.role !== "owner")) {
      throw new DomainError("DEVICE_NOT_FOUND", "Appareil introuvable.");
    }
    return { deviceId, wipeRequested: device.wipeRequestedAt !== null && device.wipedAt === null };
  }

  public async requestWipe(organizationId: string, actor: Actor, deviceId: string) {
    if (actor.role !== "owner") throw new DomainError("DEVICE_WIPE_FORBIDDEN", "Seul le titulaire peut demander une purge distante.");
    const device = await this.repository.findById(organizationId, deviceId);
    if (device === null) throw new DomainError("DEVICE_NOT_FOUND", "Appareil introuvable.");
    await this.repository.requestWipe(organizationId, deviceId, this.now());
    await this.audit.append({
      organizationId,
      ...buildAuditRecord({
        actorUserId: actor.userId,
        actorRole: actor.role,
        action: "mobile_device.wipe_requested",
        resourceType: "mobile_device",
        resourceId: deviceId,
        before: { wipeRequested: false },
        after: { wipeRequested: true },
        aiProposalId: null,
        ip: null,
        userAgent: null,
      }),
    });
    return { deviceId, wipeRequested: true };
  }

  public async acknowledgeWipe(organizationId: string, actor: Actor, deviceId: string) {
    const status = await this.status(organizationId, actor, deviceId);
    if (!status.wipeRequested) throw new DomainError("DEVICE_WIPE_NOT_REQUESTED", "Aucune purge n’est demandée.");
    const device = await this.repository.findById(organizationId, deviceId);
    if (device === null) throw new DomainError("DEVICE_NOT_FOUND", "Appareil introuvable.");
    await this.repository.acknowledgeWipe(organizationId, deviceId, this.now());
    await this.revokeUserSessions(device.userId);
    return { deviceId, wiped: true };
  }
}
