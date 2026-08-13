"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { trpcMutation } from "../../lib/trpc-server";

export type ActionState = { ok: boolean; message: string; changeId?: string; diff?: { fromUserId: string | null; toUserId: string; scheduledAt: string } };

export async function prepareMessageAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await trpcMutation("cockpit.createMessageDraft", {
      draftId: randomUUID(),
      patientId: nullable(formData.get("patientId")),
      channel: text(formData.get("channel"), "email"),
      recipient: text(formData.get("recipient")),
      subject: text(formData.get("subject")),
      body: text(formData.get("body")),
      generatedFromRuleKey: nullable(formData.get("ruleKey")),
    });
    revalidatePath("/cabinet/a-regler");
    return { ok: true, message: "Brouillon chiffré créé. Une IDEL doit maintenant le valider." };
  } catch (error) { return failed(error); }
}

export async function validateMessageAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await trpcMutation("cockpit.validateMessageDraft", { draftId: text(formData.get("draftId")) });
    revalidatePath("/cabinet/a-regler");
    return { ok: true, message: "Message validé humainement et prêt pour le canal d’envoi." };
  } catch (error) { return failed(error); }
}

export async function decideTaskAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await trpcMutation("cockpit.decideTask", {
      taskId: text(formData.get("taskId")),
      action: text(formData.get("decision"), "done"),
      snoozedUntil: nullable(formData.get("snoozedUntil")),
    });
    revalidatePath("/cabinet/a-regler");
    return { ok: true, message: "Tâche mise à jour." };
  } catch (error) { return failed(error); }
}

export async function grantAccessAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const permissions = formData.getAll("permissions").filter((value): value is string => typeof value === "string");
    await trpcMutation("cabinet.grantPatientAccess", {
      grantId: randomUUID(),
      userId: text(formData.get("userId")),
      patientId: text(formData.get("patientId")),
      startsAt: new Date(text(formData.get("startsAt"))).toISOString(),
      endsAt: new Date(text(formData.get("endsAt"))).toISOString(),
      permissions,
    });
    revalidatePath("/cabinet/equipe");
    return { ok: true, message: "Accès patient limité à cette période enregistré." };
  } catch (error) { return failed(error); }
}

export async function createContractAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await trpcMutation("cabinet.createReplacementContract", {
      contractId: randomUUID(),
      incumbentUserId: text(formData.get("incumbentUserId")),
      replacementUserId: text(formData.get("replacementUserId")),
      startsOn: text(formData.get("startsOn")),
      endsOn: text(formData.get("endsOn")),
      retrocessionRate: Number(formData.get("retrocessionRate")),
    });
    revalidatePath("/cabinet/equipe");
    return { ok: true, message: "Contrat préparé en brouillon. La signature reste obligatoire." };
  } catch (error) { return failed(error); }
}

export async function prepareRetrocessionAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const result = await trpcMutation<{ amountCents: number }>("cabinet.prepareRetrocession", {
      periodId: randomUUID(),
      incumbentUserId: text(formData.get("incumbentUserId")),
      replacementUserId: text(formData.get("replacementUserId")),
      periodStart: text(formData.get("periodStart")),
      periodEnd: text(formData.get("periodEnd")),
      grossAmountCents: Math.round(Number(formData.get("grossAmountEuros")) * 100),
      rate: Number(formData.get("rate")),
    });
    revalidatePath("/cabinet/equipe");
    return { ok: true, message: `Rétrocession préparée : ${formatMoney(result.amountCents)} à valider.` };
  } catch (error) { return failed(error); }
}

export async function previewReassignmentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const result = await trpcMutation<{ changeId: string; diff: { fromUserId: string | null; toUserId: string; scheduledAt: string } }>("cabinet.previewReassignment", {
      changeId: randomUUID(),
      visitId: text(formData.get("visitId")),
      toUserId: text(formData.get("toUserId")),
      reason: text(formData.get("reason")),
    });
    return { ok: true, message: "Vérifiez le changement avant de l’appliquer.", changeId: result.changeId, diff: result.diff };
  } catch (error) { return failed(error); }
}

export async function applyReassignmentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await trpcMutation("cabinet.applyReassignment", { changeId: text(formData.get("changeId")) });
    revalidatePath("/cabinet/equipe");
    return { ok: true, message: "Passage réaffecté et modification ajoutée à l’historique." };
  } catch (error) { return failed(error); }
}

function text(value: FormDataEntryValue | null, fallback = ""): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function nullable(value: FormDataEntryValue | null): string | null {
  const result = text(value);
  return result === "" ? null : result;
}

function failed(error: unknown): ActionState {
  return { ok: false, message: error instanceof Error ? error.message : "Action impossible." };
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}
