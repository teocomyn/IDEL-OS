import type { OfflineVisit, StoredSyncAction } from "@idel-os/sync";
import type { StructuredTransmission } from "@idel-os/shared";
import { Platform } from "react-native";

import { apiBaseUrl, authClient } from "../auth-client";

export async function fetchToday(date: string): Promise<OfflineVisit[]> {
  const visits = await trpcQuery<Array<{
    id: string;
    patientId: string;
    patientDisplayName: string;
    address: string;
    scheduledAt: string;
    estimatedArrivalAt: string;
    estimatedDurationMin: number;
    travelFromPreviousMin: number;
    status: OfflineVisit["status"];
    acts: OfflineVisit["acts"];
  }>>("field.today", { date });
  return visits.map((visit) => ({ ...visit, localVersion: 0, exception: null }));
}

export async function deliverAction(action: StoredSyncAction): Promise<void> {
  const visitId = typeof action.payload.visitId === "string" ? action.payload.visitId : "";
  if (visitId.length === 0) throw new Error("Action mobile sans passage associé.");
  if (action.kind === "visit.start") {
    await trpcMutation("visit.start", { visitId });
    return;
  }
  if (action.kind === "visit.set_act_performed") {
    await trpcMutation("visit.setActPerformed", {
      visitId,
      visitActId: action.payload.visitActId,
      performed: action.payload.performed,
    });
    return;
  }
  if (action.kind === "visit.complete") {
    await trpcMutation("visit.complete", { visitId });
    return;
  }
  if (action.kind === "visit.exception") {
    await trpcMutation("field.recordException", {
      visitId,
      idempotencyKey: action.idempotencyKey,
      type: action.payload.type,
      note: action.payload.note ?? null,
      ...(action.payload.rescheduledAt === undefined ? {} : { rescheduledAt: action.payload.rescheduledAt }),
    });
    return;
  }
  throw new Error(`Action mobile inconnue : ${action.kind}`);
}

export async function registerDevice(input: {
  deviceId: string;
  label: string;
  platform: "ios" | "android";
}): Promise<void> {
  await trpcMutation("device.register", { ...input, biometricEnabled: true });
}

export async function enforceRemoteWipe(
  deviceId: string,
  purge: () => Promise<void>,
): Promise<boolean> {
  const status = await trpcQuery<{ wipeRequested: boolean }>("device.status", { deviceId });
  if (!status.wipeRequested) return false;
  await purge();
  await trpcMutation("device.acknowledgeWipe", { deviceId });
  return true;
}

export type TransmissionView = {
  id: string;
  visitId: string;
  patientId: string;
  authorUserId: string;
  audioDurationS: number | null;
  transcriptionMode: "on_device" | "hds_server" | "manual";
  rawTranscript: string;
  structured: StructuredTransmission;
  finalText: string;
  status: "draft" | "validated";
  validatedAt: string | null;
  createdAt: string;
  receipt: { readAt: string | null; acknowledgedAt: string | null } | null;
};

export async function fetchHandover(patientId: string): Promise<TransmissionView[]> {
  return trpcQuery("transmission.sinceMyLastPassage", { patientId });
}

export async function fetchTourTransmissionSummary(date: string): Promise<{
  date: string;
  unreadCount: number;
  acknowledgementPendingCount: number;
  signalCount: number;
  items: TransmissionView[];
}> {
  return trpcQuery("transmission.tourSummary", { date });
}

export async function createTransmissionDraft(input: {
  transmissionId: string;
  patientId: string;
  visitId: string;
  rawTranscript: string;
  structured: StructuredTransmission;
  audioDurationS: number | null;
  transcriptionMode: "on_device" | "manual";
}): Promise<TransmissionView> {
  return trpcMutation("transmission.createDraft", { ...input, audioObjectKey: null });
}

export async function validateTransmission(transmissionId: string): Promise<TransmissionView> {
  return trpcMutation("transmission.validate", { transmissionId });
}

export async function acknowledgeTransmission(
  transmissionId: string,
  action: "read" | "acknowledge",
): Promise<void> {
  await trpcMutation("transmission.receipt", { transmissionId, action });
}

export type OptimizationProposal = {
  optimizationRunId: string;
  date: string;
  accepted: boolean;
  assignments: Array<{ nurseId: string; stopIds: string[]; durationS: number; distanceM: number }>;
  diff: {
    moved: Array<{ stopId: string; fromNurseId: string | null; toNurseId: string; fromPosition: number | null; toPosition: number }>;
    before: { durationS: number; distanceM: number; continuityBreaks: number; loadImbalance: number };
    after: { durationS: number; distanceM: number; continuityBreaks: number; loadImbalance: number };
    gains: { durationS: number; distanceM: number };
  };
};

export async function proposeOptimization(date: string): Promise<OptimizationProposal> {
  return trpcMutation("optimization.propose", { date, anchorAt: new Date().toISOString(), lockedVisitIds: [] });
}

export async function applyOptimization(optimizationRunId: string): Promise<OptimizationProposal> {
  return trpcMutation("optimization.apply", { optimizationRunId });
}

async function trpcQuery<T>(path: string, input: unknown): Promise<T> {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  return readTrpcResponse<T>(await fetch(`${apiBaseUrl}/trpc/${path}?input=${encoded}`, {
    credentials: "include",
    headers: authenticatedHeaders({ Accept: "application/json" }),
  }));
}

async function trpcMutation<T = unknown>(path: string, input: unknown): Promise<T> {
  return readTrpcResponse<T>(await fetch(`${apiBaseUrl}/trpc/${path}`, {
    method: "POST",
    credentials: "include",
    headers: authenticatedHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
    body: JSON.stringify({ json: input }),
  }));
}

function authenticatedHeaders(base: Record<string, string>): Record<string, string> {
  if (Platform.OS === "web") return base;
  const cookie = authClient.getCookie();
  return cookie.length === 0 ? base : { ...base, Cookie: cookie };
}

async function readTrpcResponse<T>(response: Response): Promise<T> {
  const payload = await response.json() as {
    result?: { data?: { json?: T } };
    error?: { json?: { message?: string } };
  };
  if (!response.ok || payload.result?.data?.json === undefined) {
    throw new Error(payload.error?.json?.message ?? "Synchronisation indisponible.");
  }
  return payload.result.data.json;
}
