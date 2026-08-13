import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";

import {
  adminTasks,
  asEncryptedValue,
  auditLog,
  cabinetNotifications,
  documents,
  invoicesMirror,
  messageDrafts,
  patientAccessGrants,
  patients,
  prescriptions,
  professionalDocuments,
  replacementContracts,
  retrocessionPeriods,
  transmissions,
  users,
  visitAssignmentChanges,
  visits,
  withOrganization,
  type Database,
  type EncryptionService,
} from "@idel-os/db";
import { DomainError, structuredTransmissionSchema, type AdminTaskDecision, type PatientAccessGrantInput, type ReplacementContractInput, type RetrocessionPreparation } from "@idel-os/shared";

import type { CabinetDashboard, CabinetRepository, AssignmentChange } from "./cabinet-service.js";
import type { CockpitItem, CockpitRepository, StoredMessageDraft } from "./cockpit-service.js";
import { parisDayBounds } from "./paris-time.js";

export class DrizzleCockpitRepository implements CockpitRepository {
  public constructor(
    private readonly database: Database,
    private readonly encryption: EncryptionService,
  ) {}

  public async listItems(
    organizationId: string,
    asOf: string,
    horizonDays: number,
    actor: { userId: string; role: "owner" | "idel" | "remplacant" | "secretaire" },
  ): Promise<CockpitItem[]> {
    const horizon = addDays(asOf, horizonDays);
    const dayStart = parisDayBounds(asOf).start;
    return withOrganization(this.database, organizationId, async (transaction) => {
      const prescriptionRows = await transaction.select({
        id: prescriptions.id,
        patientId: prescriptions.patientId,
        validUntil: prescriptions.validUntil,
        firstNameEnc: patients.firstNameEnc,
        lastNameEnc: patients.lastNameEnc,
      }).from(prescriptions).innerJoin(patients, and(
        eq(patients.orgId, organizationId),
        eq(patients.id, prescriptions.patientId),
      )).where(and(
        eq(prescriptions.orgId, organizationId),
        eq(prescriptions.status, "validated"),
        gte(prescriptions.validUntil, asOf),
        lte(prescriptions.validUntil, horizon),
      ));
      const taskRows = await transaction.select().from(adminTasks).where(and(
        eq(adminTasks.orgId, organizationId),
        or(
          eq(adminTasks.status, "open"),
          and(eq(adminTasks.status, "snoozed"), lte(adminTasks.snoozedUntil, asOf)),
        ),
      ));
      const patientRows = await transaction.select({
        id: patients.id,
        firstNameEnc: patients.firstNameEnc,
        lastNameEnc: patients.lastNameEnc,
      }).from(patients).where(and(eq(patients.orgId, organizationId), eq(patients.isActive, true)));
      const documentRows = await transaction.select({ patientId: documents.patientId, type: documents.type })
        .from(documents).where(eq(documents.orgId, organizationId));
      const futureVisits = await transaction.select({ patientId: visits.patientId }).from(visits).where(and(
        eq(visits.orgId, organizationId),
        gte(visits.scheduledAt, dayStart),
        inArray(visits.status, ["planned", "in_progress"]),
      ));
      const draftTransmissionRows = await transaction.select({
        id: transmissions.id,
        patientId: transmissions.patientId,
        createdAt: transmissions.createdAt,
        firstNameEnc: patients.firstNameEnc,
        lastNameEnc: patients.lastNameEnc,
      }).from(transmissions).innerJoin(patients, and(
        eq(patients.orgId, organizationId),
        eq(patients.id, transmissions.patientId),
      )).where(and(eq(transmissions.orgId, organizationId), eq(transmissions.status, "draft")));
      const invoiceRows = await transaction.select({
        id: invoicesMirror.id,
        patientId: invoicesMirror.patientId,
        amountCents: invoicesMirror.amountCents,
        status: invoicesMirror.status,
        reason: invoicesMirror.rejectedReasonCode,
        rejectedAt: invoicesMirror.rejectedAt,
        firstNameEnc: patients.firstNameEnc,
        lastNameEnc: patients.lastNameEnc,
      }).from(invoicesMirror).innerJoin(patients, and(
        eq(patients.orgId, organizationId),
        eq(patients.id, invoicesMirror.patientId),
      )).where(and(eq(invoicesMirror.orgId, organizationId), inArray(invoicesMirror.status, ["rejected", "unpaid"])));
      const contractRows = await transaction.select().from(replacementContracts).where(and(
        eq(replacementContracts.orgId, organizationId),
        or(
          inArray(replacementContracts.status, ["draft", "pending_signature"]),
          and(eq(replacementContracts.status, "active"), lte(replacementContracts.endsOn, horizon)),
        ),
      ));
      const professionalDocumentRows = await transaction.select({
        id: professionalDocuments.id,
        userId: professionalDocuments.userId,
        name: professionalDocuments.name,
        expiresAt: professionalDocuments.expiresAt,
        userName: users.name,
      }).from(professionalDocuments).innerJoin(users, and(
        eq(users.orgId, organizationId),
        eq(users.id, professionalDocuments.userId),
      )).where(and(
        eq(professionalDocuments.orgId, organizationId),
        gte(professionalDocuments.expiresAt, asOf),
        lte(professionalDocuments.expiresAt, horizon),
      ));

      const items: CockpitItem[] = [];
      for (const row of prescriptionRows) {
        const label = await this.patientLabel(organizationId, row.firstNameEnc, row.lastNameEnc);
        items.push({
          id: `prescription:${row.id}`,
          category: "expiring_prescription",
          priority: daysBetween(asOf, row.validUntil!) <= 7 ? "urgent" : "high",
          title: `Ordonnance de ${label} à renouveler`,
          detail: `Échéance le ${formatDate(row.validUntil!)}. Le courrier peut être préparé avant validation.`,
          dueDate: row.validUntil,
          patientId: row.patientId,
          resourceType: "prescription",
          resourceId: row.id,
          amountCents: null,
          suggestedAction: "Préparer la demande de renouvellement",
          taskId: null,
        });
      }
      for (const row of taskRows.filter(({ type }) => type === "renewal_request")) {
        items.push({
          id: `task:${row.id}`,
          category: "renewal_request",
          priority: priority(row.priority),
          title: row.title,
          detail: row.description,
          dueDate: row.dueDate,
          patientId: row.relatedResourceType === "patient" ? row.relatedResourceId : null,
          resourceType: row.relatedResourceType ?? "admin_task",
          resourceId: row.relatedResourceId ?? row.id,
          amountCents: null,
          suggestedAction: "Traiter la demande",
          taskId: row.id,
        });
      }
      const documentsByPatient = new Map<string, Set<string>>();
      for (const row of documentRows) {
        if (row.patientId === null) continue;
        const current = documentsByPatient.get(row.patientId) ?? new Set<string>();
        current.add(normalizeDocumentType(row.type));
        documentsByPatient.set(row.patientId, current);
      }
      const plannedPatientIds = new Set(futureVisits.map(({ patientId }) => patientId));
      for (const row of patientRows) {
        const label = await this.patientLabel(organizationId, row.firstNameEnc, row.lastNameEnc);
        const present = documentsByPatient.get(row.id) ?? new Set<string>();
        const missing = ["ordonnance", "attestation_droits"].filter((type) => !present.has(type));
        if (missing.length > 0) items.push({
          id: `missing-document:${row.id}`,
          category: "missing_document",
          priority: "high",
          title: `Dossier incomplet · ${label}`,
          detail: `Document${missing.length > 1 ? "s" : ""} manquant${missing.length > 1 ? "s" : ""} : ${missing.map(documentLabel).join(", ")}.`,
          dueDate: null,
          patientId: row.id,
          resourceType: "patient",
          resourceId: row.id,
          amountCents: null,
          suggestedAction: "Demander les documents",
          taskId: null,
        });
        if (!plannedPatientIds.has(row.id)) items.push({
          id: `without-visit:${row.id}`,
          category: "active_without_visit",
          priority: "urgent",
          title: `Aucun passage planifié · ${label}`,
          detail: "Patient actif sans prochain passage. Vérifiez le plan de soins avant publication de la tournée.",
          dueDate: asOf,
          patientId: row.id,
          resourceType: "patient",
          resourceId: row.id,
          amountCents: null,
          suggestedAction: "Planifier un passage",
          taskId: null,
        });
      }
      for (const row of draftTransmissionRows) {
        const label = await this.patientLabel(organizationId, row.firstNameEnc, row.lastNameEnc);
        items.push({
          id: `transmission:${row.id}`,
          category: "unvalidated_transmission",
          priority: "urgent",
          title: `Transmission à valider · ${label}`,
          detail: "Le contenu clinique reste un brouillon et n’apparaît pas dans la relève tant qu’une IDEL ne l’a pas validé.",
          dueDate: isoDate(row.createdAt),
          patientId: row.patientId,
          resourceType: "transmission",
          resourceId: row.id,
          amountCents: null,
          suggestedAction: "Relire et valider",
          taskId: null,
        });
      }
      for (const row of invoiceRows) {
        const label = await this.patientLabel(organizationId, row.firstNameEnc, row.lastNameEnc);
        const rejected = row.status === "rejected";
        items.push({
          id: `invoice:${row.id}`,
          category: rejected ? "rejected_invoice" : "unpaid_invoice",
          priority: rejected ? "urgent" : "high",
          title: `${rejected ? "Rejet" : "Impayé"} · ${label} · ${formatMoney(row.amountCents)}`,
          detail: rejected ? `Motif importé : ${row.reason ?? "à qualifier"}.` : "Paiement non rapproché. Préparez une relance avant envoi.",
          dueDate: row.rejectedAt === null ? null : isoDate(row.rejectedAt),
          patientId: row.patientId,
          resourceType: "invoice",
          resourceId: row.id,
          amountCents: row.amountCents,
          suggestedAction: rejected ? "Corriger le rejet" : "Préparer une relance",
          taskId: null,
        });
      }
      for (const row of contractRows) items.push({
        id: `contract:${row.id}`,
        category: "replacement_contract",
        priority: row.status === "active" && daysBetween(asOf, row.endsOn) <= 7 ? "urgent" : "high",
        title: row.status === "active" ? "Contrat de remplacement bientôt échu" : "Contrat de remplacement à finaliser",
        detail: `Période du ${formatDate(row.startsOn)} au ${formatDate(row.endsOn)} · rétrocession ${row.retrocessionRate} %.`,
        dueDate: row.status === "active" ? row.endsOn : row.startsOn,
        patientId: null,
        resourceType: "replacement_contract",
        resourceId: row.id,
        amountCents: null,
        suggestedAction: row.status === "active" ? "Préparer le renouvellement" : "Faire signer le contrat",
        taskId: null,
      });
      for (const row of professionalDocumentRows) items.push({
        id: `professional-document:${row.id}`,
        category: "expiring_professional_document",
        priority: daysBetween(asOf, row.expiresAt!) <= 7 ? "urgent" : "high",
        title: `${row.name} arrive à expiration`,
        detail: `${row.userName} · échéance le ${formatDate(row.expiresAt!)}.`,
        dueDate: row.expiresAt,
        patientId: null,
        resourceType: "professional_document",
        resourceId: row.id,
        amountCents: null,
        suggestedAction: "Déposer le document renouvelé",
        taskId: null,
      });
      if (actor.role !== "secretaire") return items;
      const accessRows = await transaction.select().from(patientAccessGrants).where(and(
        eq(patientAccessGrants.orgId, organizationId),
        eq(patientAccessGrants.userId, actor.userId),
        lte(patientAccessGrants.startsAt, dayStart),
        gte(patientAccessGrants.endsAt, dayStart),
      ));
      return items.filter((item) => {
        if (item.patientId === null) return true;
        const grant = accessRows.find(({ patientId }) => patientId === item.patientId);
        if (grant === undefined) return false;
        if (item.category === "active_without_visit") return grant.canSchedule;
        if (item.category === "rejected_invoice" || item.category === "unpaid_invoice") return grant.canBill;
        return grant.canRead;
      });
    });
  }

  public async canPrepareMessageForPatient(
    organizationId: string,
    userId: string,
    patientId: string,
    at: Date,
  ): Promise<boolean> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [grant] = await transaction.select({ id: patientAccessGrants.id }).from(patientAccessGrants).where(and(
        eq(patientAccessGrants.orgId, organizationId),
        eq(patientAccessGrants.userId, userId),
        eq(patientAccessGrants.patientId, patientId),
        lte(patientAccessGrants.startsAt, at),
        gte(patientAccessGrants.endsAt, at),
        or(eq(patientAccessGrants.canRead, true), eq(patientAccessGrants.canBill, true)),
      )).limit(1);
      return grant !== undefined;
    });
  }

  public async decideTask(organizationId: string, actorUserId: string, decision: AdminTaskDecision): Promise<void> {
    await withOrganization(this.database, organizationId, async (transaction) => {
      const [task] = await transaction.select({ id: adminTasks.id }).from(adminTasks).where(and(
        eq(adminTasks.orgId, organizationId), eq(adminTasks.id, decision.taskId),
      )).limit(1);
      if (task === undefined) throw new DomainError("ADMIN_TASK_NOT_FOUND", "Tâche administrative introuvable.");
      const now = new Date();
      await transaction.update(adminTasks).set({
        status: decision.action === "reopen" ? "open" : decision.action === "snooze" ? "snoozed" : "done",
        snoozedUntil: decision.action === "snooze" ? decision.snoozedUntil : null,
        completedByUserId: decision.action === "done" ? actorUserId : null,
        completedAt: decision.action === "done" ? now : null,
        updatedAt: now,
      }).where(and(eq(adminTasks.orgId, organizationId), eq(adminTasks.id, decision.taskId)));
    });
  }

  public async createMessageDraft(draft: StoredMessageDraft): Promise<void> {
    await withOrganization(this.database, draft.organizationId, async (transaction) => {
      await transaction.insert(messageDrafts).values({
        id: draft.id,
        orgId: draft.organizationId,
        patientId: draft.patientId,
        channel: draft.channel,
        recipientEnc: draft.recipientEnc,
        subjectEnc: draft.subjectEnc,
        bodyEnc: draft.bodyEnc,
        status: draft.status,
        generatedFromRuleKey: draft.generatedFromRuleKey,
        createdByUserId: draft.createdByUserId,
        createdAt: draft.createdAt,
        updatedAt: draft.createdAt,
      });
    });
  }

  public async findMessageDraft(organizationId: string, draftId: string): Promise<StoredMessageDraft | null> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [row] = await transaction.select().from(messageDrafts).where(and(
        eq(messageDrafts.orgId, organizationId), eq(messageDrafts.id, draftId),
      )).limit(1);
      if (row === undefined) return null;
      return {
        id: row.id,
        organizationId: row.orgId,
        patientId: row.patientId,
        channel: row.channel as StoredMessageDraft["channel"],
        recipientEnc: asEncryptedValue(row.recipientEnc),
        subjectEnc: asEncryptedValue(row.subjectEnc),
        bodyEnc: asEncryptedValue(row.bodyEnc),
        status: row.status,
        generatedFromRuleKey: row.generatedFromRuleKey,
        createdByUserId: row.createdByUserId,
        validatedByUserId: row.validatedByUserId,
        validatedAt: row.validatedAt,
        sentAt: row.sentAt,
        createdAt: row.createdAt,
      };
    });
  }

  public async listMessageDrafts(organizationId: string): Promise<StoredMessageDraft[]> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const rows = await transaction.select().from(messageDrafts).where(and(
        eq(messageDrafts.orgId, organizationId), inArray(messageDrafts.status, ["draft", "validated"]),
      )).orderBy(desc(messageDrafts.createdAt));
      return rows.map((row) => ({
        id: row.id, organizationId: row.orgId, patientId: row.patientId,
        channel: row.channel as StoredMessageDraft["channel"],
        recipientEnc: asEncryptedValue(row.recipientEnc), subjectEnc: asEncryptedValue(row.subjectEnc),
        bodyEnc: asEncryptedValue(row.bodyEnc), status: row.status,
        generatedFromRuleKey: row.generatedFromRuleKey, createdByUserId: row.createdByUserId,
        validatedByUserId: row.validatedByUserId, validatedAt: row.validatedAt,
        sentAt: row.sentAt, createdAt: row.createdAt,
      }));
    });
  }

  public async validateMessageDraft(organizationId: string, draftId: string, actorUserId: string, at: Date): Promise<void> {
    await withOrganization(this.database, organizationId, async (transaction) => {
      await transaction.update(messageDrafts).set({
        status: "validated", validatedByUserId: actorUserId, validatedAt: at, updatedAt: at,
      }).where(and(eq(messageDrafts.orgId, organizationId), eq(messageDrafts.id, draftId), eq(messageDrafts.status, "draft")));
    });
  }

  private async patientLabel(organizationId: string, firstNameEnc: string, lastNameEnc: string): Promise<string> {
    const [firstName, lastName] = await Promise.all([
      this.encryption.decrypt(organizationId, asEncryptedValue(firstNameEnc)),
      this.encryption.decrypt(organizationId, asEncryptedValue(lastNameEnc)),
    ]);
    return `${firstName} ${lastName.slice(0, 1).toUpperCase()}.`;
  }
}

export class DrizzleCabinetRepository implements CabinetRepository {
  public constructor(
    private readonly database: Database,
    private readonly encryption: EncryptionService,
  ) {}

  public async dashboard(
    organizationId: string,
    actor: { userId: string; role: "owner" | "idel" | "remplacant" | "secretaire" },
    from: string,
    to: string,
  ): Promise<CabinetDashboard> {
    const start = parisDayBounds(from).start;
    const end = parisDayBounds(to).end;
    return withOrganization(this.database, organizationId, async (transaction) => {
      const memberRows = await transaction.select().from(users).where(eq(users.orgId, organizationId)).orderBy(asc(users.firstName));
      const visitRows = await transaction.select({
        visit: visits,
        firstNameEnc: patients.firstNameEnc,
        lastNameEnc: patients.lastNameEnc,
      }).from(visits).innerJoin(patients, and(eq(patients.orgId, organizationId), eq(patients.id, visits.patientId)))
        .where(and(eq(visits.orgId, organizationId), gte(visits.scheduledAt, start), lte(visits.scheduledAt, end)))
        .orderBy(asc(visits.scheduledAt));
      const grants = actor.role === "owner" ? [] : await transaction.select().from(patientAccessGrants).where(and(
        eq(patientAccessGrants.orgId, organizationId),
        eq(patientAccessGrants.userId, actor.userId),
        lte(patientAccessGrants.startsAt, end),
        gte(patientAccessGrants.endsAt, start),
      ));
      const transmissionRows = await transaction.select({
        transmission: transmissions,
        firstNameEnc: patients.firstNameEnc,
        lastNameEnc: patients.lastNameEnc,
        authorName: users.name,
      }).from(transmissions)
        .innerJoin(patients, and(eq(patients.orgId, organizationId), eq(patients.id, transmissions.patientId)))
        .innerJoin(users, eq(users.id, transmissions.authorUserId))
        .where(and(
          eq(transmissions.orgId, organizationId),
          eq(transmissions.status, "validated"),
          gte(transmissions.createdAt, start),
          lte(transmissions.createdAt, end),
        )).orderBy(desc(transmissions.createdAt));
      const notificationRows = await transaction.select().from(cabinetNotifications).where(and(
        eq(cabinetNotifications.orgId, organizationId),
        isNull(cabinetNotifications.readAt),
        inArray(cabinetNotifications.severity, ["important", "urgent"]),
        or(isNull(cabinetNotifications.userId), eq(cabinetNotifications.userId, actor.userId)),
      )).orderBy(desc(cabinetNotifications.createdAt));
      const contractRows = await transaction.select({ id: replacementContracts.id }).from(replacementContracts).where(and(
        eq(replacementContracts.orgId, organizationId),
        inArray(replacementContracts.status, ["pending_signature", "active"]),
        lte(replacementContracts.startsOn, to),
        gte(replacementContracts.endsOn, from),
      ));
      const retrocessionRows = await transaction.select({ id: retrocessionPeriods.id }).from(retrocessionPeriods).where(and(
        eq(retrocessionPeriods.orgId, organizationId), eq(retrocessionPeriods.status, "draft"),
      ));
      const historyRows = await transaction.select({
        id: auditLog.id,
        action: auditLog.action,
        actorUserId: auditLog.actorUserId,
        resourceType: auditLog.resourceType,
        resourceId: auditLog.resourceId,
        createdAt: auditLog.createdAt,
      }).from(auditLog).where(and(
        eq(auditLog.orgId, organizationId),
        inArray(auditLog.resourceType, ["cabinet", "administration"]),
      )).orderBy(desc(auditLog.createdAt)).limit(20);

      const memberById = new Map(memberRows.map((member) => [member.id, member]));
      const patientLabels = new Map<string, string>();
      const canAccess = (patientId: string, assignedUserId: string | null, permission: "read" | "schedule" | "transmission") => {
        if (actor.role === "owner") return true;
        if (assignedUserId === actor.userId && actor.role !== "secretaire") return true;
        return grants.some((grant) => grant.patientId === patientId && (
          permission === "read" ? grant.canRead : permission === "schedule" ? grant.canSchedule : grant.canTransmit
        ));
      };
      const label = async (patientId: string, firstNameEnc: string, lastNameEnc: string) => {
        const cached = patientLabels.get(patientId);
        if (cached !== undefined) return cached;
        const [firstName, lastName] = await Promise.all([
          this.encryption.decrypt(organizationId, asEncryptedValue(firstNameEnc)),
          this.encryption.decrypt(organizationId, asEncryptedValue(lastNameEnc)),
        ]);
        const value = `${firstName} ${lastName.slice(0, 1).toUpperCase()}.`;
        patientLabels.set(patientId, value);
        return value;
      };

      const schedule = [] as CabinetDashboard["schedule"];
      for (const row of visitRows) {
        const visible = canAccess(row.visit.patientId, row.visit.assignedUserId, "schedule");
        schedule.push({
          visitId: row.visit.id,
          patientId: row.visit.patientId,
          patientLabel: visible ? await label(row.visit.patientId, row.firstNameEnc, row.lastNameEnc) : "Patient protégé",
          patientMasked: !visible,
          assignedUserId: row.visit.assignedUserId,
          assignedUserLabel: row.visit.assignedUserId === null ? "Non affecté" : memberById.get(row.visit.assignedUserId)?.name ?? "IDEL",
          scheduledAt: row.visit.scheduledAt,
          estimatedDurationMin: row.visit.estimatedDurationMin,
          status: row.visit.status,
        });
      }
      const handover = [] as CabinetDashboard["handover"];
      for (const row of transmissionRows) {
        const relatedVisit = visitRows.find(({ visit }) => visit.id === row.transmission.visitId)?.visit;
        const visible = actor.role !== "secretaire" && canAccess(
          row.transmission.patientId,
          relatedVisit?.assignedUserId ?? null,
          "transmission",
        );
        let signalCount = 0;
        let finalText: string | null = null;
        if (visible && row.transmission.structuredJsonEnc !== null && row.transmission.finalTextEnc !== null) {
          const structured = structuredTransmissionSchema.parse(JSON.parse(await this.encryption.decrypt(
            organizationId, asEncryptedValue(row.transmission.structuredJsonEnc),
          )));
          signalCount = structured.concerns.filter(({ urgency }) => urgency === "a_signaler").length;
          finalText = await this.encryption.decrypt(organizationId, asEncryptedValue(row.transmission.finalTextEnc));
        }
        handover.push({
          transmissionId: row.transmission.id,
          patientId: row.transmission.patientId,
          patientLabel: visible ? await label(row.transmission.patientId, row.firstNameEnc, row.lastNameEnc) : "Patient protégé",
          patientMasked: !visible,
          authorLabel: row.authorName,
          finalText,
          createdAt: row.transmission.createdAt,
          signalCount,
        });
      }
      const visitStats = new Map<string, { count: number; done: number; minutes: number }>();
      for (const row of visitRows) {
        if (row.visit.assignedUserId === null) continue;
        const stats = visitStats.get(row.visit.assignedUserId) ?? { count: 0, done: 0, minutes: 0 };
        stats.count += 1;
        stats.done += row.visit.status === "done" ? 1 : 0;
        stats.minutes += row.visit.estimatedDurationMin;
        visitStats.set(row.visit.assignedUserId, stats);
      }
      const maxMinutes = Math.max(1, ...[...visitStats.values()].map(({ minutes }) => minutes));
      return {
        from,
        to,
        members: memberRows.map((member) => ({
          id: member.id,
          displayName: member.name,
          role: member.role,
          roleLabel: roleLabel(member.role),
          isActive: member.isActive,
          lastSeenAt: member.lastSeenAt,
        })),
        schedule,
        workloads: memberRows.filter(({ role, isActive }) => role !== "secretaire" && isActive).map((member) => {
          const stats = visitStats.get(member.id) ?? { count: 0, done: 0, minutes: 0 };
          return {
            userId: member.id,
            displayName: member.name,
            visitCount: stats.count,
            completedCount: stats.done,
            plannedMinutes: stats.minutes,
            workloadPercent: Math.round((stats.minutes / maxMinutes) * 100),
          };
        }).sort((left, right) => right.plannedMinutes - left.plannedMinutes),
        handover,
        notifications: notificationRows.map((notification) => ({
          id: notification.id,
          severity: notification.severity as "important" | "urgent",
          kind: notification.kind,
          title: notification.title,
          resourceType: notification.resourceType,
          resourceId: notification.resourceId,
          createdAt: notification.createdAt,
        })),
        activeContracts: contractRows.length,
        retrocessionsToValidate: retrocessionRows.length,
        recentChanges: historyRows.map((history) => ({
          ...history,
          actorLabel: memberById.get(history.actorUserId)?.name ?? "Professionnelle du cabinet",
        })),
      };
    });
  }

  public async upsertAccessGrant(organizationId: string, actorUserId: string, grant: PatientAccessGrantInput): Promise<void> {
    await withOrganization(this.database, organizationId, async (transaction) => {
      await transaction.insert(patientAccessGrants).values({
        id: grant.grantId,
        orgId: organizationId,
        userId: grant.userId,
        patientId: grant.patientId,
        startsAt: new Date(grant.startsAt),
        endsAt: new Date(grant.endsAt),
        canRead: grant.permissions.includes("read"),
        canCare: grant.permissions.includes("care"),
        canTransmit: grant.permissions.includes("transmission"),
        canSchedule: grant.permissions.includes("schedule"),
        canBill: grant.permissions.includes("billing"),
        grantedByUserId: actorUserId,
      }).onConflictDoUpdate({
        target: patientAccessGrants.id,
        set: {
          startsAt: new Date(grant.startsAt), endsAt: new Date(grant.endsAt),
          canRead: grant.permissions.includes("read"), canCare: grant.permissions.includes("care"),
          canTransmit: grant.permissions.includes("transmission"), canSchedule: grant.permissions.includes("schedule"),
          canBill: grant.permissions.includes("billing"), grantedByUserId: actorUserId,
        },
      });
    });
  }

  public async createReplacementContract(organizationId: string, _actorUserId: string, contract: ReplacementContractInput): Promise<void> {
    await withOrganization(this.database, organizationId, async (transaction) => {
      await transaction.insert(replacementContracts).values({
        id: contract.contractId,
        orgId: organizationId,
        incumbentUserId: contract.incumbentUserId,
        replacementUserId: contract.replacementUserId,
        startsOn: contract.startsOn,
        endsOn: contract.endsOn,
        retrocessionRate: contract.retrocessionRate.toFixed(2),
        status: "draft",
      });
    });
  }

  public async createRetrocession(
    organizationId: string,
    actorUserId: string,
    preparation: RetrocessionPreparation & { amountCents: number },
  ): Promise<void> {
    await withOrganization(this.database, organizationId, async (transaction) => {
      await transaction.insert(retrocessionPeriods).values({
        id: preparation.periodId,
        orgId: organizationId,
        incumbentUserId: preparation.incumbentUserId,
        replacementUserId: preparation.replacementUserId,
        periodStart: preparation.periodStart,
        periodEnd: preparation.periodEnd,
        grossAmountCents: preparation.grossAmountCents,
        rate: preparation.rate.toFixed(2),
        amountCents: preparation.amountCents,
        status: "draft",
        preparedByUserId: actorUserId,
      });
    });
  }

  public async getVisitAssignment(organizationId: string, visitId: string) {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [row] = await transaction.select({
        assignedUserId: visits.assignedUserId, scheduledAt: visits.scheduledAt, status: visits.status,
      }).from(visits).where(and(eq(visits.orgId, organizationId), eq(visits.id, visitId))).limit(1);
      return row ?? null;
    });
  }

  public async createAssignmentChange(change: AssignmentChange): Promise<void> {
    await withOrganization(this.database, change.organizationId, async (transaction) => {
      await transaction.insert(visitAssignmentChanges).values({
        id: change.id,
        orgId: change.organizationId,
        visitId: change.visitId,
        fromUserId: change.fromUserId,
        toUserId: change.toUserId,
        reason: change.reason,
        status: change.status,
        proposedByUserId: change.proposedByUserId,
        createdAt: change.createdAt,
      });
    });
  }

  public async getAssignmentChange(organizationId: string, changeId: string): Promise<AssignmentChange | null> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [row] = await transaction.select().from(visitAssignmentChanges).where(and(
        eq(visitAssignmentChanges.orgId, organizationId), eq(visitAssignmentChanges.id, changeId),
      )).limit(1);
      if (row === undefined) return null;
      return {
        id: row.id, organizationId: row.orgId, visitId: row.visitId, fromUserId: row.fromUserId,
        toUserId: row.toUserId, reason: row.reason, status: row.status,
        proposedByUserId: row.proposedByUserId, createdAt: row.createdAt,
      };
    });
  }

  public async applyAssignmentChange(organizationId: string, changeId: string, actorUserId: string): Promise<void> {
    await withOrganization(this.database, organizationId, async (transaction) => {
      const [change] = await transaction.select().from(visitAssignmentChanges).where(and(
        eq(visitAssignmentChanges.orgId, organizationId), eq(visitAssignmentChanges.id, changeId),
      )).limit(1).for("update");
      if (change === undefined) throw new DomainError("ASSIGNMENT_CHANGE_NOT_FOUND", "Proposition introuvable.");
      if (change.status !== "proposed") throw new DomainError("ASSIGNMENT_CHANGE_ALREADY_HANDLED", "Proposition déjà traitée.");
      const [visit] = await transaction.select({ assignedUserId: visits.assignedUserId, status: visits.status }).from(visits)
        .where(and(eq(visits.orgId, organizationId), eq(visits.id, change.visitId))).limit(1).for("update");
      if (visit === undefined || visit.status !== "planned" || visit.assignedUserId !== change.fromUserId) {
        throw new DomainError("ASSIGNMENT_CHANGE_STALE", "Le planning a changé. Affichez un nouveau diff avant de réaffecter.");
      }
      const [target] = await transaction.select({ id: users.id }).from(users).where(and(
        eq(users.orgId, organizationId), eq(users.id, change.toUserId), eq(users.isActive, true),
      )).limit(1);
      if (target === undefined) throw new DomainError("ASSIGNMENT_TARGET_UNAVAILABLE", "L’IDEL destinataire n’est plus active.");
      await transaction.update(visits).set({ assignedUserId: change.toUserId }).where(and(
        eq(visits.orgId, organizationId), eq(visits.id, change.visitId),
      ));
      await transaction.update(visitAssignmentChanges).set({
        status: "applied", appliedByUserId: actorUserId, appliedAt: new Date(),
      }).where(and(eq(visitAssignmentChanges.orgId, organizationId), eq(visitAssignmentChanges.id, changeId)));
    });
  }
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.ceil((Date.parse(`${to}T12:00:00.000Z`) - Date.parse(`${from}T12:00:00.000Z`)) / 86_400_000);
}

function priority(value: number): "urgent" | "high" | "normal" {
  return value >= 80 ? "urgent" : value >= 50 ? "high" : "normal";
}

function normalizeDocumentType(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
}

function documentLabel(value: string): string {
  return value === "ordonnance" ? "ordonnance" : "attestation de droits";
}

function roleLabel(role: "owner" | "idel" | "remplacant" | "secretaire"): string {
  return role === "owner" ? "Titulaire" : role === "idel" ? "Collaboratrice" : role === "remplacant" ? "Remplaçante" : "Secrétaire";
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Paris" })
    .format(new Date(`${value}T12:00:00.000Z`));
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}
