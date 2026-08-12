import type { ActionQueue } from "./action-queue.js";

export type OfflineVisitStatus = "planned" | "in_progress" | "done" | "missed" | "cancelled" | "refused";
export type VisitExceptionType = "absence" | "refusal" | "hospitalization" | "emergency" | "reschedule";

export type OfflineVisit = {
  id: string;
  patientId: string;
  patientDisplayName: string;
  address: string;
  scheduledAt: string;
  estimatedArrivalAt: string;
  estimatedDurationMin: number;
  travelFromPreviousMin: number;
  status: OfflineVisitStatus;
  localVersion: number;
  acts: Array<{ id: string; label: string; performed: boolean }>;
  exception: { type: VisitExceptionType; note: string | null } | null;
};

export interface OfflineTourStorage {
  listVisits(): Promise<OfflineVisit[]>;
  getVisit(id: string): Promise<OfflineVisit | null>;
  putVisit(visit: OfflineVisit): Promise<void>;
  replaceVisits(visits: OfflineVisit[]): Promise<void>;
  purge(): Promise<void>;
}

export class InMemoryOfflineTourStorage implements OfflineTourStorage {
  private readonly visits = new Map<string, OfflineVisit>();

  public async listVisits(): Promise<OfflineVisit[]> {
    return [...this.visits.values()].map((visit) => structuredClone(visit));
  }

  public async getVisit(id: string): Promise<OfflineVisit | null> {
    const visit = this.visits.get(id);
    return visit === undefined ? null : structuredClone(visit);
  }

  public async putVisit(visit: OfflineVisit): Promise<void> {
    this.visits.set(visit.id, structuredClone(visit));
  }

  public async replaceVisits(visits: OfflineVisit[]): Promise<void> {
    this.visits.clear();
    for (const visit of visits) this.visits.set(visit.id, structuredClone(visit));
  }

  public async purge(): Promise<void> {
    this.visits.clear();
  }
}

export class OfflineTourController {
  public constructor(
    private readonly storage: OfflineTourStorage,
    private readonly queue: ActionQueue,
    private readonly createId: () => string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async hydrate(visits: OfflineVisit[]): Promise<void> {
    await this.storage.replaceVisits(visits);
  }

  public async list(): Promise<OfflineVisit[]> {
    return (await this.storage.listVisits()).sort((left, right) =>
      left.estimatedArrivalAt.localeCompare(right.estimatedArrivalAt),
    );
  }

  public async start(visitId: string): Promise<OfflineVisit> {
    const visit = await this.requireVisit(visitId);
    if (visit.status === "in_progress") return visit;
    if (visit.status !== "planned") throw new Error("Seul un passage planifié peut être démarré.");
    return this.mutate(visit, "visit.start", {}, { ...visit, status: "in_progress" });
  }

  public async setActPerformed(visitId: string, actId: string, performed: boolean): Promise<OfflineVisit> {
    const visit = await this.requireVisit(visitId);
    if (visit.status !== "in_progress") throw new Error("Démarrez le passage avant la checklist.");
    if (!visit.acts.some(({ id }) => id === actId)) throw new Error("Acte introuvable.");
    return this.mutate(
      visit,
      "visit.set_act_performed",
      { visitActId: actId, performed },
      {
        ...visit,
        acts: visit.acts.map((act) => act.id === actId ? { ...act, performed } : act),
      },
    );
  }

  public async complete(visitId: string): Promise<OfflineVisit> {
    const visit = await this.requireVisit(visitId);
    if (visit.status === "done") return visit;
    if (visit.status !== "in_progress") throw new Error("Ce passage n’est pas en cours.");
    if (visit.acts.length === 0 || visit.acts.some(({ performed }) => !performed)) {
      throw new Error("Confirmez chaque acte avant de terminer le passage.");
    }
    return this.mutate(visit, "visit.complete", {}, { ...visit, status: "done" });
  }

  public async recordException(
    visitId: string,
    type: VisitExceptionType,
    note: string | null,
    rescheduledAt?: string,
  ): Promise<OfflineVisit> {
    const visit = await this.requireVisit(visitId);
    if (type === "reschedule" && rescheduledAt === undefined) {
      throw new Error("Une nouvelle date est obligatoire pour reporter le passage.");
    }
    const status: OfflineVisitStatus = type === "absence"
      ? "missed"
      : type === "refusal"
        ? "refused"
        : type === "reschedule"
          ? "planned"
          : "cancelled";
    const next = {
      ...visit,
      status,
      scheduledAt: rescheduledAt ?? visit.scheduledAt,
      estimatedArrivalAt: rescheduledAt ?? visit.estimatedArrivalAt,
      exception: { type, note },
    };
    return this.mutate(
      visit,
      "visit.exception",
      { type, note, ...(rescheduledAt === undefined ? {} : { rescheduledAt }) },
      next,
    );
  }

  private async mutate(
    before: OfflineVisit,
    kind: string,
    payload: Record<string, unknown>,
    after: OfflineVisit,
  ): Promise<OfflineVisit> {
    const id = this.createId();
    const updated = { ...after, localVersion: before.localVersion + 1 };
    // L'état local et l'action utilisent le même ordre logique : l'action est persistée
    // avant que l'interface confirme la mutation à l'utilisateur.
    await this.queue.enqueue({
      id,
      idempotencyKey: id,
      kind,
      payload: { visitId: before.id, expectedVersion: before.localVersion, ...payload },
      createdAt: this.now().toISOString(),
    });
    await this.storage.putVisit(updated);
    await this.recalculateUpcoming();
    return updated;
  }

  private async recalculateUpcoming(): Promise<void> {
    const visits = (await this.storage.listVisits()).sort((left, right) =>
      left.scheduledAt.localeCompare(right.scheduledAt),
    );
    let cursor = this.now().getTime();
    for (const visit of visits) {
      if (["done", "missed", "cancelled", "refused"].includes(visit.status)) continue;
      const arrival = Math.max(
        new Date(visit.scheduledAt).getTime(),
        cursor + visit.travelFromPreviousMin * 60_000,
      );
      const recalculated = { ...visit, estimatedArrivalAt: new Date(arrival).toISOString() };
      await this.storage.putVisit(recalculated);
      cursor = arrival + visit.estimatedDurationMin * 60_000;
    }
  }

  private async requireVisit(id: string): Promise<OfflineVisit> {
    const visit = await this.storage.getVisit(id);
    if (visit === null) throw new Error("Passage hors ligne introuvable.");
    return visit;
  }
}
