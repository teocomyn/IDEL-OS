"use client";

import { useActionState, useState } from "react";

import type { CabinetDashboard } from "../../../lib/cabinet-types";
import {
  applyReassignmentAction,
  createContractAction,
  grantAccessAction,
  prepareRetrocessionAction,
  previewReassignmentAction,
  type ActionState,
} from "../actions";

const initialState: ActionState = { ok: false, message: "" };

export function CabinetWorkspace({ dashboard }: { dashboard: CabinetDashboard }) {
  const [tab, setTab] = useState<"planning" | "equipe" | "releve" | "gestion">("planning");
  const clinicalMembers = dashboard.members.filter(({ role, isActive }) => role !== "secretaire" && isActive);
  const patients = [...new Map(dashboard.schedule.filter(({ patientMasked }) => !patientMasked).map((item) => [item.patientId, { id: item.patientId, label: item.patientLabel }])).values()];
  return <>
    <section className="cabinet-kpis cabinet-team-kpis">
      <article><span className="kpi-icon">👥</span><div><strong>{dashboard.members.filter(({ isActive }) => isActive).length}</strong><span>membres actifs</span></div></article>
      <article><span className="kpi-icon safe">↗</span><div><strong>{dashboard.schedule.length}</strong><span>passages cette semaine</span></div></article>
      <article><span className="kpi-icon money">%</span><div><strong>{dashboard.retrocessionsToValidate}</strong><span>rétrocessions à valider</span></div></article>
      <article><span className="kpi-icon urgent">!</span><div><strong>{dashboard.notifications.length}</strong><span>notifications importantes</span></div></article>
    </section>
    <nav className="cabinet-tabs" aria-label="Sections du cabinet">
      <button className={tab === "planning" ? "active" : ""} onClick={() => setTab("planning")}>Planning partagé</button>
      <button className={tab === "equipe" ? "active" : ""} onClick={() => setTab("equipe")}>Équipe & charge</button>
      <button className={tab === "releve" ? "active" : ""} onClick={() => setTab("releve")}>Relève collective</button>
      <button className={tab === "gestion" ? "active" : ""} onClick={() => setTab("gestion")}>Accès, contrats & rétrocessions</button>
    </nav>
    {tab === "planning" && <Planning dashboard={dashboard} clinicalMembers={clinicalMembers} />}
    {tab === "equipe" && <Team dashboard={dashboard} />}
    {tab === "releve" && <Handover dashboard={dashboard} />}
    {tab === "gestion" && <Management dashboard={dashboard} clinicalMembers={clinicalMembers} patients={patients} />}
  </>;
}

function Planning({ dashboard, clinicalMembers }: { dashboard: CabinetDashboard; clinicalMembers: CabinetDashboard["members"] }) {
  const grouped = groupSchedule(dashboard.schedule);
  return <div className="cabinet-work-grid">
    <section className="cabinet-panel shared-planning"><div className="panel-heading"><div><span className="cabinet-eyebrow">7 jours</span><h2>Planning partagé</h2></div><span>{dashboard.schedule.length} passages</span></div>
      {dashboard.schedule.length === 0 ? <Empty label="Aucun passage sur cette période" /> : <div className="planning-days">{[...grouped.entries()].map(([date, visits]) => <section key={date} className="planning-day"><header><strong>{dayLabel(date)}</strong><span>{visits.length} passages</span></header><div>{visits.map((visit) => <article key={visit.visitId} className="planning-visit"><time>{timeLabel(visit.scheduledAt)}</time><span className={`visit-dot status-${visit.status}`} /><div><strong>{visit.patientLabel}</strong><small>{visit.assignedUserLabel} · {visit.estimatedDurationMin} min</small></div><span className="visit-status">{statusLabel(visit.status)}</span>{visit.status === "planned" && <Reassignment visit={visit} members={clinicalMembers} />}</article>)}</div></section>)}</div>}
    </section>
    <aside className="cabinet-side-stack">
      <Notifications items={dashboard.notifications} />
      <section className="cabinet-panel mini-history"><div className="panel-heading compact"><div><span className="cabinet-eyebrow">Traçabilité</span><h2>Dernières modifications</h2></div></div>{dashboard.recentChanges.length === 0 ? <Empty label="Aucune modification récente" /> : dashboard.recentChanges.slice(0, 6).map((item) => <div className="history-row" key={item.id}><span>↻</span><div><strong>{actionLabel(item.action)}</strong><small>{item.actorLabel} · {relativeDate(item.createdAt)}</small></div></div>)}</section>
    </aside>
  </div>;
}

function Team({ dashboard }: { dashboard: CabinetDashboard }) {
  return <div className="cabinet-work-grid"><section className="cabinet-panel"><div className="panel-heading"><div><span className="cabinet-eyebrow">Équipe</span><h2>Membres du cabinet</h2></div><span>{dashboard.members.length}</span></div><div className="team-list">{dashboard.members.map((member) => <article key={member.id}><Avatar name={member.displayName}/><div><strong>{member.displayName}</strong><small>{member.roleLabel}</small></div><span className={member.isActive ? "member-active" : "member-inactive"}>{member.isActive ? "Active" : "Inactive"}</span></article>)}</div></section>
    <section className="cabinet-panel workload-panel"><div className="panel-heading"><div><span className="cabinet-eyebrow">Équilibrage</span><h2>Charge de travail</h2></div><span>Temps planifié</span></div><div className="workload-list">{dashboard.workloads.map((workload) => <article key={workload.userId}><div><strong>{workload.displayName}</strong><span>{workload.visitCount} passages · {formatDuration(workload.plannedMinutes)}</span></div><div className="workload-track"><i style={{ width: `${workload.workloadPercent}%` }}/></div><b>{workload.workloadPercent}%</b></article>)}</div><p className="panel-footnote">La charge aide à décider. Une réaffectation reste toujours confirmée par une personne.</p></section></div>;
}

function Handover({ dashboard }: { dashboard: CabinetDashboard }) {
  return <section className="cabinet-panel collective-handover"><div className="panel-heading"><div><span className="cabinet-eyebrow">Relève validée</span><h2>Ce que le cabinet doit savoir</h2></div><span>{dashboard.handover.length} transmissions</span></div>{dashboard.handover.length === 0 ? <Empty label="Aucune transmission validée sur la période" /> : <div>{dashboard.handover.map((item) => <article key={item.transmissionId}><Avatar name={item.patientLabel}/><div><div className="handover-top"><strong>{item.patientLabel}</strong>{item.signalCount > 0 && <span>{item.signalCount} à signaler</span>}<time>{relativeDate(item.createdAt)}</time></div><p>{item.finalText ?? "Contenu clinique masqué : vous n’avez pas d’autorisation active pour ce patient."}</p><small>Validé par {item.authorLabel}</small></div></article>)}</div>}</section>;
}

function Management({ dashboard, clinicalMembers, patients }: { dashboard: CabinetDashboard; clinicalMembers: CabinetDashboard["members"]; patients: Array<{id:string;label:string}> }) {
  return <div className="management-grid">
    <AccessForm members={dashboard.members} patients={patients}/>
    <ContractForm members={clinicalMembers}/>
    <RetrocessionForm members={clinicalMembers}/>
    <section className="cabinet-panel management-summary"><span className="cabinet-eyebrow">Suivi</span><h2>Gestion du cabinet</h2><div><span><strong>{dashboard.activeContracts}</strong> contrats actifs</span><span><strong>{dashboard.retrocessionsToValidate}</strong> rétrocessions à valider</span><span><strong>{dashboard.recentChanges.length}</strong> événements tracés</span></div><p>Les droits expirent automatiquement à la fin de la période. Les contrats et rétrocessions restent en brouillon jusqu’à leur validation.</p></section>
  </div>;
}

function Reassignment({ visit, members }: { visit: CabinetDashboard["schedule"][number]; members: CabinetDashboard["members"] }) {
  const [open, setOpen] = useState(false);
  const [preview, previewAction, previewPending] = useActionState(previewReassignmentAction, initialState);
  const [apply, applyAction, applyPending] = useActionState(applyReassignmentAction, initialState);
  return <div className="reassign-control"><button className="reassign-open" onClick={() => setOpen((value) => !value)} aria-label={`Réaffecter ${visit.patientLabel}`}>↔</button>{open && <div className="reassign-popover"><strong>Réaffecter ce passage</strong><form action={previewAction}><input type="hidden" name="visitId" value={visit.visitId}/><select name="toUserId" required defaultValue=""><option value="" disabled>Choisir une IDEL</option>{members.filter(({ id }) => id !== visit.assignedUserId).map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select><input name="reason" placeholder="Motif du changement" minLength={3} required/><button disabled={previewPending}>{previewPending ? "Calcul…" : "Afficher le diff"}</button></form>{preview.message !== "" && <ActionNotice state={preview}/>} {preview.changeId !== undefined && preview.diff !== undefined && <div className="reassign-diff"><span><small>Avant</small>{visit.assignedUserLabel}</span><b>→</b><span><small>Après</small>{members.find(({ id }) => id === preview.diff?.toUserId)?.displayName}</span><form action={applyAction}><input type="hidden" name="changeId" value={preview.changeId}/><button disabled={applyPending}>{applyPending ? "Application…" : "Confirmer"}</button></form></div>}{apply.message !== "" && <ActionNotice state={apply}/>}</div>}</div>;
}

function AccessForm({ members, patients }: { members: CabinetDashboard["members"]; patients: Array<{id:string;label:string}> }) {
  const [state, action, pending] = useActionState(grantAccessAction, initialState);
  return <section className="cabinet-panel management-form"><span className="cabinet-eyebrow">Droits patient</span><h2>Accorder un accès limité</h2><form action={action}><label>Professionnelle<select name="userId" required><option value="">Choisir</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName} · {member.roleLabel}</option>)}</select></label><label>Patient<select name="patientId" required><option value="">Choisir</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.label}</option>)}</select></label><div className="form-columns"><label>Du<input name="startsAt" type="datetime-local" required/></label><label>Au<input name="endsAt" type="datetime-local" required/></label></div><fieldset><legend>Autorisations</legend>{[["read","Dossier"],["care","Soins"],["transmission","Transmissions"],["schedule","Planning"],["billing","Facturation"]].map(([value,label]) => <label key={value}><input type="checkbox" name="permissions" value={value}/>{label}</label>)}</fieldset><button disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer l’accès"}</button><ActionNotice state={state}/></form></section>;
}

function ContractForm({ members }: { members: CabinetDashboard["members"] }) {
  const [state, action, pending] = useActionState(createContractAction, initialState);
  return <section className="cabinet-panel management-form"><span className="cabinet-eyebrow">Remplacement</span><h2>Préparer un contrat</h2><form action={action}><label>Titulaire<select name="incumbentUserId" required><option value="">Choisir</option>{members.filter(({ role }) => role === "owner" || role === "idel").map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label><label>Remplaçante<select name="replacementUserId" required><option value="">Choisir</option>{members.filter(({ role }) => role === "remplacant").map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label><div className="form-columns"><label>Début<input name="startsOn" type="date" required/></label><label>Fin<input name="endsOn" type="date" required/></label></div><label>Taux de rétrocession (%)<input name="retrocessionRate" type="number" min="0" max="100" step="0.01" required/></label><button disabled={pending}>{pending ? "Préparation…" : "Créer le brouillon"}</button><ActionNotice state={state}/></form></section>;
}

function RetrocessionForm({ members }: { members: CabinetDashboard["members"] }) {
  const [state, action, pending] = useActionState(prepareRetrocessionAction, initialState);
  return <section className="cabinet-panel management-form"><span className="cabinet-eyebrow">Rétrocession</span><h2>Préparer une période</h2><form action={action}><label>Titulaire<select name="incumbentUserId" required><option value="">Choisir</option>{members.filter(({ role }) => role !== "remplacant").map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label><label>Remplaçante<select name="replacementUserId" required><option value="">Choisir</option>{members.filter(({ role }) => role === "remplacant").map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label><div className="form-columns"><label>Du<input name="periodStart" type="date" required/></label><label>Au<input name="periodEnd" type="date" required/></label></div><div className="form-columns"><label>Honoraires bruts (€)<input name="grossAmountEuros" type="number" min="0" step="0.01" required/></label><label>Taux (%)<input name="rate" type="number" min="0" max="100" step="0.01" required/></label></div><button disabled={pending}>{pending ? "Calcul…" : "Calculer le brouillon"}</button><ActionNotice state={state}/></form></section>;
}

function Notifications({ items }: { items: CabinetDashboard["notifications"] }) { return <section className="cabinet-panel notification-panel"><div className="panel-heading compact"><div><span className="cabinet-eyebrow">Signal utile uniquement</span><h2>Important</h2></div><span>{items.length}</span></div>{items.length === 0 ? <Empty label="Aucune notification importante" /> : items.map((item) => <article key={item.id} className={item.severity}><span>!</span><div><strong>{item.title}</strong><small>{relativeDate(item.createdAt)}</small></div></article>)}</section>; }
function Avatar({ name }: { name: string }) { return <span className="cabinet-avatar">{name.split(" ").slice(0,2).map((part) => part[0]).join("")}</span>; }
function Empty({ label }: { label: string }) { return <div className="side-empty"><span>✓</span><p>{label}</p></div>; }
function ActionNotice({ state }: { state: ActionState }) { return state.message === "" ? null : <p className={`action-notice ${state.ok ? "success" : "error"}`} role="status">{state.message}</p>; }
function timeLabel(value: string) { return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(value)); }
function dayLabel(value: string) { return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00Z`)); }
function relativeDate(value: string) { return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(value)); }
function formatDuration(minutes: number) { return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2,"0")}`; }
function statusLabel(status: string) { return status === "done" ? "Terminé" : status === "in_progress" ? "En cours" : status === "planned" ? "Planifié" : status; }
function actionLabel(action: string) { return ({ "visit.reassigned": "Passage réaffecté", "patient_access.granted": "Accès patient accordé", "replacement_contract.created": "Contrat préparé", "retrocession.prepared": "Rétrocession préparée" } as Record<string,string>)[action] ?? "Organisation mise à jour"; }
function groupSchedule(schedule: CabinetDashboard["schedule"]): Map<string, CabinetDashboard["schedule"]> {
  const grouped = new Map<string, CabinetDashboard["schedule"]>();
  for (const visit of schedule) {
    const date = visit.scheduledAt.slice(0, 10);
    grouped.set(date, [...(grouped.get(date) ?? []), visit]);
  }
  return grouped;
}
