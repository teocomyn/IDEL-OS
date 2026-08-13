export type CockpitCategory =
  | "expiring_prescription" | "renewal_request" | "missing_document"
  | "unvalidated_transmission" | "active_without_visit" | "rejected_invoice"
  | "unpaid_invoice" | "replacement_contract" | "expiring_professional_document";

export type CockpitItem = {
  id: string;
  category: CockpitCategory;
  priority: "urgent" | "high" | "normal";
  title: string;
  detail: string;
  dueDate: string | null;
  patientId: string | null;
  resourceType: string;
  resourceId: string;
  amountCents: number | null;
  suggestedAction: string;
  taskId: string | null;
};

export type CockpitResponse = {
  asOf: string;
  total: number;
  urgentCount: number;
  amountToRecoverCents: number;
  counts: Partial<Record<CockpitCategory, number>>;
  items: CockpitItem[];
};

export type MessageDraftView = {
  draftId: string;
  patientId: string | null;
  channel: "email" | "sms" | "letter" | "mssante";
  recipient: string;
  subject: string;
  body: string;
  status: "draft" | "validated" | "sent" | "cancelled";
  createdAt: string;
  validatedAt: string | null;
  requiresHumanValidation: boolean;
};

export type CabinetDashboard = {
  from: string;
  to: string;
  members: Array<{ id: string; displayName: string; role: "owner" | "idel" | "remplacant" | "secretaire"; roleLabel: string; isActive: boolean; lastSeenAt: string | null }>;
  schedule: Array<{ visitId: string; patientId: string; patientLabel: string; patientMasked: boolean; assignedUserId: string | null; assignedUserLabel: string; scheduledAt: string; estimatedDurationMin: number; status: string }>;
  workloads: Array<{ userId: string; displayName: string; visitCount: number; completedCount: number; plannedMinutes: number; workloadPercent: number }>;
  handover: Array<{ transmissionId: string; patientId: string; patientLabel: string; patientMasked: boolean; authorLabel: string; finalText: string | null; createdAt: string; signalCount: number }>;
  notifications: Array<{ id: string; severity: "important" | "urgent"; kind: string; title: string; resourceType: string | null; resourceId: string | null; createdAt: string }>;
  activeContracts: number;
  retrocessionsToValidate: number;
  recentChanges: Array<{ id: string; action: string; actorUserId: string; actorLabel: string; resourceType: string; resourceId: string; createdAt: string }>;
};
