"use client";

import { useActionState, useMemo, useState } from "react";

import type { CockpitCategory, CockpitItem, CockpitResponse, MessageDraftView } from "../../../lib/cabinet-types";
import { decideTaskAction, prepareMessageAction, validateMessageAction, type ActionState } from "../actions";

const initialState: ActionState = { ok: false, message: "" };
const categoryMeta: Record<CockpitCategory, { label: string; icon: string }> = {
  expiring_prescription: { label: "Ordonnances", icon: "Rx" },
  renewal_request: { label: "Renouvellements", icon: "↻" },
  missing_document: { label: "Documents", icon: "□" },
  unvalidated_transmission: { label: "Transmissions", icon: "◉" },
  active_without_visit: { label: "Sans passage", icon: "!" },
  rejected_invoice: { label: "Rejets", icon: "×" },
  unpaid_invoice: { label: "Impayés", icon: "€" },
  replacement_contract: { label: "Contrats", icon: "✎" },
  expiring_professional_document: { label: "Documents pro", icon: "⌁" },
};

export function CockpitBoard({ cockpit, drafts }: { cockpit: CockpitResponse; drafts: MessageDraftView[] }) {
  const [selected, setSelected] = useState<CockpitCategory | "all">("all");
  const visible = useMemo(() => selected === "all" ? cockpit.items : cockpit.items.filter(({ category }) => category === selected), [cockpit.items, selected]);
  const categories = Object.entries(cockpit.counts).filter((entry): entry is [CockpitCategory, number] => typeof entry[1] === "number" && entry[1] > 0);
  return <>
    <section className="cabinet-kpis" aria-label="Résumé des actions">
      <article><span className="kpi-icon urgent">!</span><div><strong>{cockpit.urgentCount}</strong><span>urgences administratives</span></div></article>
      <article><span className="kpi-icon">✓</span><div><strong>{cockpit.total}</strong><span>actions à traiter</span></div></article>
      <article><span className="kpi-icon money">€</span><div><strong>{formatMoney(cockpit.amountToRecoverCents)}</strong><span>à récupérer ou corriger</span></div></article>
      <article><span className="kpi-icon safe">⌁</span><div><strong>100 %</strong><span>validé avant envoi</span></div></article>
    </section>
    <div className="cockpit-layout">
      <section className="cabinet-panel cockpit-list-panel">
        <div className="panel-heading"><div><span className="cabinet-eyebrow">File de travail</span><h2>Priorités du cabinet</h2></div><span>{visible.length} action{visible.length > 1 ? "s" : ""}</span></div>
        <div className="cockpit-filters">
          <button className={selected === "all" ? "active" : ""} onClick={() => setSelected("all")}>Tout <b>{cockpit.total}</b></button>
          {categories.map(([category, count]) => <button key={category} className={selected === category ? "active" : ""} onClick={() => setSelected(category)}>{categoryMeta[category].label} <b>{count}</b></button>)}
        </div>
        <div className="cockpit-items">
          {visible.length === 0 ? <div className="cockpit-empty"><span>✓</span><strong>Tout est réglé dans cette catégorie</strong><small>Les nouvelles actions apparaîtront automatiquement ici.</small></div> : visible.map((item) => <CockpitRow key={item.id} item={item} />)}
        </div>
      </section>
      <aside className="cockpit-side">
        <section className="cabinet-panel draft-panel">
          <div className="panel-heading compact"><div><span className="cabinet-eyebrow">Validation humaine</span><h2>Courriers préparés</h2></div><span>{drafts.filter(({ status }) => status === "draft").length}</span></div>
          {drafts.length === 0 ? <div className="side-empty"><span>✎</span><p>Aucun brouillon. Préparez un message depuis une action.</p></div> : <div className="draft-list">{drafts.slice(0, 5).map((draft) => <DraftRow key={draft.draftId} draft={draft} />)}</div>}
        </section>
        <section className="cockpit-safety"><span>✓</span><div><strong>Zéro envoi automatique</strong><p>Le logiciel prépare. Une IDEL relit, corrige et valide avant remise au canal d’envoi.</p></div></section>
      </aside>
    </div>
  </>;
}

function CockpitRow({ item }: { item: CockpitItem }) {
  const [open, setOpen] = useState(false);
  const [taskState, taskAction, taskPending] = useActionState(decideTaskAction, initialState);
  const [messageState, messageAction, messagePending] = useActionState(prepareMessageAction, initialState);
  const meta = categoryMeta[item.category];
  return <article className={`cockpit-item priority-${item.priority}`}>
    <span className="cockpit-item-icon">{meta.icon}</span>
    <div className="cockpit-item-copy"><div className="cockpit-item-top"><span>{meta.label}</span>{item.dueDate !== null && <time dateTime={item.dueDate}>{dateLabel(item.dueDate)}</time>}</div><h3>{item.title}</h3><p>{item.detail}</p><div className="cockpit-item-actions"><button onClick={() => setOpen((value) => !value)}>{open ? "Fermer" : item.suggestedAction}</button>{item.taskId !== null && <form action={taskAction}><input type="hidden" name="taskId" value={item.taskId}/><input type="hidden" name="decision" value="done"/><button className="quiet" disabled={taskPending}>{taskPending ? "…" : "Marquer réglé"}</button></form>}</div>
      {taskState.message !== "" && <ActionNotice state={taskState} />}
      {open && <form action={messageAction} className="message-composer">
        <input type="hidden" name="patientId" value={item.patientId ?? ""}/><input type="hidden" name="ruleKey" value={item.category}/><input type="hidden" name="channel" value="email"/>
        <label>Destinataire<input name="recipient" type="email" placeholder="professionnel@exemple.fr" required /></label>
        <label>Objet<input name="subject" defaultValue={item.title} required /></label>
        <label>Message<textarea name="body" defaultValue={messageTemplate(item)} rows={5} required /></label>
        <div><small>Le brouillon est chiffré. Il ne sera pas envoyé à cette étape.</small><button disabled={messagePending}>{messagePending ? "Préparation…" : "Créer le brouillon"}</button></div>
        {messageState.message !== "" && <ActionNotice state={messageState} />}
      </form>}
    </div>
  </article>;
}

function DraftRow({ draft }: { draft: MessageDraftView }) {
  const [state, action, pending] = useActionState(validateMessageAction, initialState);
  return <article className="draft-row"><div><span>{draft.channel.toUpperCase()} · {draft.status === "draft" ? "À valider" : "Validé"}</span><strong>{draft.subject}</strong><small>{draft.recipient}</small></div>{draft.status === "draft" && <form action={action}><input type="hidden" name="draftId" value={draft.draftId}/><button disabled={pending}>{pending ? "…" : "Valider"}</button></form>}{state.message !== "" && <ActionNotice state={state} />}</article>;
}

function ActionNotice({ state }: { state: ActionState }) { return <p className={`action-notice ${state.ok ? "success" : "error"}`} role="status">{state.message}</p>; }
function formatMoney(cents: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100); }
function dateLabel(value: string) { return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00.000Z`)); }
function messageTemplate(item: CockpitItem) { return `Bonjour,\n\nNous vous contactons au sujet de : ${item.title.toLowerCase()}.\n\nMerci de nous confirmer la marche à suivre.\n\nCordialement,\nLe cabinet infirmier`; }
