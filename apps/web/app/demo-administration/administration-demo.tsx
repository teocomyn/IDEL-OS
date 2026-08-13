"use client";

import { useState } from "react";

import type { CabinetDashboard, CockpitResponse, MessageDraftView } from "../../lib/cabinet-types";
import { CockpitBoard } from "../cabinet/a-regler/cockpit-board";
import { CabinetWorkspace } from "../cabinet/equipe/workspace";

export function AdministrationDemo() {
  const [view, setView] = useState<"cockpit" | "cabinet">("cockpit");
  return <main className="cabinet-page">
    <header className="cabinet-page-head">
      <div><span className="cabinet-eyebrow">Démonstration · données 100 % synthétiques</span><h1>{view === "cockpit" ? "À régler" : "Cabinet"}</h1><p>{view === "cockpit" ? "Toutes les priorités administratives regroupées, expliquées et actionnables." : "Planning, équipe, relève et gestion du cabinet réunis dans le même espace."}</p></div>
      <div className="cabinet-head-status"><span><i />Mode démonstration</span><small>Aucune donnée réelle</small></div>
    </header>
    <nav className="cabinet-tabs demo-admin-switch" aria-label="Changer de démonstration"><button className={view === "cockpit" ? "active" : ""} onClick={() => setView("cockpit")}>Cockpit administratif</button><button className={view === "cabinet" ? "active" : ""} onClick={() => setView("cabinet")}>Organisation du cabinet</button></nav>
    {view === "cockpit"
      ? <CockpitBoard cockpit={cockpit} drafts={drafts}/>
      : <CabinetWorkspace dashboard={dashboard}/>}
  </main>;
}

const cockpit: CockpitResponse = {
  asOf: "2026-08-13",
  total: 8,
  urgentCount: 3,
  amountToRecoverCents: 36_840,
  counts: { expiring_prescription: 2, missing_document: 1, unvalidated_transmission: 1, active_without_visit: 1, rejected_invoice: 1, unpaid_invoice: 1, replacement_contract: 1 },
  items: [
    item("active_without_visit", "Aucun passage planifié · Lucie B.", "Patiente active sans prochain passage. Vérifiez le plan de soins avant publication de la tournée.", "urgent", "Planifier un passage", "2026-08-13"),
    item("unvalidated_transmission", "Transmission à valider · Bernard M.", "Le vocal de 07:42 a été structuré. Il reste invisible dans la relève tant qu’Emma ne l’a pas validé.", "urgent", "Relire et valider", "2026-08-13"),
    item("rejected_invoice", "Rejet · Alice R. · 126,40 €", "Motif importé : prescription absente à la date des soins.", "urgent", "Corriger le rejet", "2026-08-12", 12_640),
    item("expiring_prescription", "Ordonnance de Marie S. à renouveler", "Échéance dans 6 jours. Une demande peut être préparée avant validation.", "high", "Préparer la demande", "2026-08-19"),
    item("missing_document", "Dossier incomplet · Paul D.", "Documents manquants : attestation de droits, ordonnance signée.", "high", "Demander les documents", null),
    item("unpaid_invoice", "Impayé · Jeanne L. · 242,00 €", "Paiement non rapproché depuis 21 jours. Préparez une relance avant envoi.", "high", "Préparer une relance", "2026-07-23", 24_200),
    item("replacement_contract", "Contrat d’Emma à finaliser", "Remplacement du 18 au 29 août · rétrocession 10 %.", "high", "Faire signer le contrat", "2026-08-18"),
    item("expiring_prescription", "Ordonnance de René C. à renouveler", "Échéance dans 24 jours.", "normal", "Préparer la demande", "2026-09-06"),
  ],
};

const drafts: MessageDraftView[] = [{
  draftId: "0198f54c-4064-7000-8000-000000000901",
  patientId: "0198f54c-4064-7000-8000-000000000902",
  channel: "email",
  recipient: "cabinet.medical@demo.test",
  subject: "Renouvellement ordonnance · Marie S.",
  body: "Message entièrement synthétique.",
  status: "draft",
  createdAt: "2026-08-13T08:10:00.000Z",
  validatedAt: null,
  requiresHumanValidation: true,
}];

const members: CabinetDashboard["members"] = [
  { id: "0198f54c-4064-7000-8000-000000000910", displayName: "Sophie Martin", role: "owner", roleLabel: "Titulaire", isActive: true, lastSeenAt: "2026-08-13T09:40:00.000Z" },
  { id: "0198f54c-4064-7000-8000-000000000911", displayName: "Emma Bernard", role: "remplacant", roleLabel: "Remplaçante", isActive: true, lastSeenAt: "2026-08-13T09:38:00.000Z" },
  { id: "0198f54c-4064-7000-8000-000000000912", displayName: "Claire Robert", role: "idel", roleLabel: "Collaboratrice", isActive: true, lastSeenAt: "2026-08-13T08:55:00.000Z" },
  { id: "0198f54c-4064-7000-8000-000000000913", displayName: "Jade Petit", role: "secretaire", roleLabel: "Secrétaire", isActive: true, lastSeenAt: "2026-08-13T09:20:00.000Z" },
];

const dashboard: CabinetDashboard = {
  from: "2026-08-13", to: "2026-08-19", members,
  schedule: [
    visit("920", "930", "Marie S.", members[0]!, "2026-08-13T06:45:00.000Z", "done", 25),
    visit("921", "931", "Bernard M.", members[1]!, "2026-08-13T07:25:00.000Z", "done", 20),
    visit("922", "932", "Alice R.", members[1]!, "2026-08-13T08:05:00.000Z", "in_progress", 30),
    visit("923", "933", "Lucie B.", members[2]!, "2026-08-13T09:10:00.000Z", "planned", 20),
    visit("924", "934", "Paul D.", members[0]!, "2026-08-14T06:50:00.000Z", "planned", 35),
    visit("925", "935", "René C.", members[2]!, "2026-08-14T07:40:00.000Z", "planned", 20),
  ],
  workloads: [
    { userId: members[0]!.id, displayName: members[0]!.displayName, visitCount: 12, completedCount: 4, plannedMinutes: 295, workloadPercent: 100 },
    { userId: members[1]!.id, displayName: members[1]!.displayName, visitCount: 11, completedCount: 5, plannedMinutes: 270, workloadPercent: 92 },
    { userId: members[2]!.id, displayName: members[2]!.displayName, visitCount: 9, completedCount: 3, plannedMinutes: 225, workloadPercent: 76 },
  ],
  handover: [
    { transmissionId: "0198f54c-4064-7000-8000-000000000940", patientId: "0198f54c-4064-7000-8000-000000000930", patientLabel: "Marie S.", patientMasked: false, authorLabel: "Sophie Martin", finalText: "Observé : pansement propre, absence de rougeur.\nProchain passage : contrôler la tolérance du nouveau dispositif.", createdAt: "2026-08-13T07:12:00.000Z", signalCount: 0 },
    { transmissionId: "0198f54c-4064-7000-8000-000000000941", patientId: "0198f54c-4064-7000-8000-000000000931", patientLabel: "Bernard M.", patientMasked: false, authorLabel: "Emma Bernard", finalText: "Rapporté : fatigue depuis hier. Observé : glycémie capillaire à surveiller au prochain passage.", createdAt: "2026-08-13T08:02:00.000Z", signalCount: 1 },
  ],
  notifications: [{ id: "0198f54c-4064-7000-8000-000000000950", severity: "urgent", kind: "schedule", title: "Un passage prioritaire reste sans affectation demain matin", resourceType: "visit", resourceId: "0198f54c-4064-7000-8000-000000000951", createdAt: "2026-08-13T08:45:00.000Z" }],
  activeContracts: 1, retrocessionsToValidate: 2,
  recentChanges: [
    { id: "0198f54c-4064-7000-8000-000000000960", action: "visit.reassigned", actorUserId: members[0]!.id, actorLabel: members[0]!.displayName, resourceType: "cabinet", resourceId: "0198f54c-4064-7000-8000-000000000961", createdAt: "2026-08-13T08:30:00.000Z" },
    { id: "0198f54c-4064-7000-8000-000000000962", action: "patient_access.granted", actorUserId: members[0]!.id, actorLabel: members[0]!.displayName, resourceType: "cabinet", resourceId: "0198f54c-4064-7000-8000-000000000963", createdAt: "2026-08-12T15:10:00.000Z" },
  ],
};

function item(category: CockpitResponse["items"][number]["category"], title: string, detail: string, priority: CockpitResponse["items"][number]["priority"], suggestedAction: string, dueDate: string | null, amountCents: number | null = null): CockpitResponse["items"][number] {
  const resourceId = "0198f54c-4064-7000-8000-000000000999";
  return { id: `${category}:${title}`, category, title, detail, priority, suggestedAction, dueDate, amountCents, patientId: resourceId, resourceType: "demo", resourceId, taskId: null };
}

function visit(suffix: string, patientSuffix: string, patientLabel: string, member: CabinetDashboard["members"][number], scheduledAt: string, status: string, estimatedDurationMin: number): CabinetDashboard["schedule"][number] {
  return { visitId: `0198f54c-4064-7000-8000-000000000${suffix}`, patientId: `0198f54c-4064-7000-8000-000000000${patientSuffix}`, patientLabel, patientMasked: false, assignedUserId: member.id, assignedUserLabel: member.displayName, scheduledAt, estimatedDurationMin, status };
}
