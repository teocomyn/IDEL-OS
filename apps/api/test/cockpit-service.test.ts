import { randomBytes } from "node:crypto";

import { EncryptionService, LocalKeyProvider } from "@idel-os/db";
import { describe, expect, it } from "vitest";

import { CockpitService, type CockpitItem, type CockpitRepository, type StoredMessageDraft } from "../src/services/cockpit-service.js";
import { InMemoryAuditSink } from "../src/services/in-memory-repositories.js";

const organizationId = "0198f54c-4064-7000-8000-000000000601";
const owner = { userId: "0198f54c-4064-7000-8000-000000000602", role: "owner" as const };
const secretary = { userId: "0198f54c-4064-7000-8000-000000000603", role: "secretaire" as const };
const replacement = { userId: "0198f54c-4064-7000-8000-000000000604", role: "remplacant" as const };

class FakeCockpitRepository implements CockpitRepository {
  public items: CockpitItem[] = [];
  public drafts = new Map<string, StoredMessageDraft>();
  public patientAccess = true;

  public async listItems(): Promise<CockpitItem[]> { return this.items; }
  public async canPrepareMessageForPatient(): Promise<boolean> { return this.patientAccess; }
  public async decideTask(): Promise<void> {}
  public async createMessageDraft(draft: StoredMessageDraft): Promise<void> { this.drafts.set(draft.id, draft); }
  public async findMessageDraft(_organizationId: string, draftId: string): Promise<StoredMessageDraft | null> {
    return this.drafts.get(draftId) ?? null;
  }
  public async listMessageDrafts(): Promise<StoredMessageDraft[]> { return [...this.drafts.values()]; }
  public async validateMessageDraft(_organizationId: string, draftId: string, actorUserId: string, at: Date): Promise<void> {
    const draft = this.drafts.get(draftId);
    if (draft !== undefined) this.drafts.set(draftId, { ...draft, status: "validated", validatedByUserId: actorUserId, validatedAt: at });
  }
}

function setup() {
  const repository = new FakeCockpitRepository();
  const audit = new InMemoryAuditSink();
  const encryption = new EncryptionService(new LocalKeyProvider(randomBytes(32)));
  const service = new CockpitService(repository, audit, encryption, () => new Date("2026-08-13T10:00:00.000Z"));
  return { repository, audit, service };
}

describe("CockpitService", () => {
  it("orders urgent work first and totals money to recover", async () => {
    const { repository, service } = setup();
    repository.items = [
      item({ id: "invoice:1", category: "unpaid_invoice", priority: "high", amountCents: 6500 }),
      item({ id: "transmission:1", category: "unvalidated_transmission", priority: "urgent", amountCents: null }),
    ];
    const result = await service.list(organizationId, owner, { asOf: "2026-08-13", horizonDays: 30, categories: [] });
    expect(result.items.map(({ id }) => id)).toEqual(["transmission:1", "invoice:1"]);
    expect(result.urgentCount).toBe(1);
    expect(result.amountToRecoverCents).toBe(6500);
  });

  it("keeps the administrative cockpit out of replacement access", async () => {
    const { service } = setup();
    await expect(service.list(organizationId, replacement, {
      asOf: "2026-08-13", horizonDays: 30, categories: [],
    })).rejects.toThrow("réservé au cabinet");
  });

  it("encrypts prepared messages and requires an IDEL validation before delivery", async () => {
    const { repository, service } = setup();
    const input = {
      draftId: "0198f54c-4064-7000-8000-000000000610",
      patientId: "0198f54c-4064-7000-8000-000000000611",
      channel: "email" as const,
      recipient: "cabinet.medical@example.test",
      subject: "Renouvellement fictif",
      body: "Merci de préparer le renouvellement de cette ordonnance synthétique.",
      generatedFromRuleKey: "prescription.expiry",
    };
    await service.createMessageDraft(organizationId, secretary, input);
    const stored = repository.drafts.get(input.draftId);
    expect(stored?.recipientEnc).not.toContain(input.recipient);
    expect(stored?.bodyEnc).not.toContain("ordonnance synthétique");
    await expect(service.getValidatedMessageForDelivery(organizationId, secretary, input.draftId))
      .rejects.toThrow("validation humaine");
    await expect(service.validateMessageDraft(organizationId, secretary, input.draftId))
      .rejects.toThrow("IDEL titulaire ou collaboratrice");
    await service.validateMessageDraft(organizationId, owner, input.draftId);
    const payload = await service.getValidatedMessageForDelivery(organizationId, secretary, input.draftId);
    expect(payload.body).toBe(input.body);
  });

  it("prevents a secretary from preparing patient correspondence outside an active grant", async () => {
    const { repository, service } = setup();
    repository.patientAccess = false;
    await expect(service.createMessageDraft(organizationId, secretary, {
      draftId: "0198f54c-4064-7000-8000-000000000620",
      patientId: "0198f54c-4064-7000-8000-000000000621",
      channel: "email",
      recipient: "cabinet.medical@example.test",
      subject: "Demande synthétique",
      body: "Ce message ne doit pas être enregistré sans droit patient actif.",
      generatedFromRuleKey: null,
    })).rejects.toThrow("Aucun accès administratif actif");
  });
});

function item(overrides: Partial<CockpitItem> & Pick<CockpitItem, "id" | "category" | "priority">): CockpitItem {
  return {
    title: "Action synthétique",
    detail: "Détail synthétique",
    dueDate: null,
    patientId: null,
    resourceType: "test",
    resourceId: "0198f54c-4064-7000-8000-000000000699",
    amountCents: null,
    suggestedAction: "Traiter",
    taskId: null,
    ...overrides,
  };
}
