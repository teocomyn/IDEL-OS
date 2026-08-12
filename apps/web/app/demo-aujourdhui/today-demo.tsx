"use client";

import { proposeRouteOptimization, type TravelMatrix } from "@idel-os/routing";
import Link from "next/link";
import { useMemo, useState } from "react";

type VisitStatus = "done" | "planned" | "in_progress";
type VisitPriority = "normal" | "watch" | "signal";
type DemoVisit = {
  id: string;
  time: string;
  window: string;
  initials: string;
  patient: string;
  age: number;
  duration: number;
  status: VisitStatus;
  priority: VisitPriority;
  label: string;
  address: string;
  access: string;
  acts: Array<{ id: string; label: string; detail: string }>;
  note: string | null;
};

const initialVisits: DemoVisit[] = [
  { id: "aline", time: "06:30", window: "06:30–07:00", initials: "AL", patient: "Aline Lierre", age: 76, duration: 15, status: "done", priority: "normal", label: "Traitement habituel", address: "3 rue Fictive, Paris", access: "Rez-de-chaussée · sonnette fictive", acts: [{ id: "traitement", label: "Administration selon prescription", detail: "Tracer le passage" }], note: null },
  { id: "bernard", time: "06:55", window: "06:45–07:15", initials: "BM", patient: "Bernard Mistral", age: 69, duration: 12, status: "done", priority: "normal", label: "Surveillance", address: "18 avenue Exemple, Paris", access: "Bâtiment A · informations fictives", acts: [{ id: "surveillance", label: "Surveillance prescrite", detail: "Constantes selon le plan" }], note: null },
  { id: "rose", time: "07:25", window: "07:00–08:30", initials: "RC", patient: "Rose Carmin", age: 78, duration: 30, status: "planned", priority: "watch", label: "Pansement à surveiller", address: "Résidence fictive Les Tilleuls", access: "Bâtiment B · 2e étage · code de démonstration", acts: [{ id: "pansement", label: "Pansement de plaie non chirurgicale", detail: "Matériel n° 2 préparé" }, { id: "douleur", label: "Évaluation de la douleur", detail: "Tracer l’EVA dans la transmission" }], note: "Contrôler l’évolution de la rougeur signalée dans la relève." },
  { id: "marcel", time: "08:05", window: "07:45–09:00", initials: "MD", patient: "Marcel Dune", age: 71, duration: 15, status: "planned", priority: "normal", label: "Traitement du matin", address: "12 rue Démonstration, Paris", access: "Maison fictive · portail gris", acts: [{ id: "glycemie", label: "Glycémie capillaire", detail: "Selon prescription" }, { id: "administration", label: "Administration selon prescription", detail: "Après contrôle" }], note: null },
  { id: "ines", time: "08:40", window: "08:15–09:00", initials: "IB", patient: "Inès Brume", age: 64, duration: 18, status: "planned", priority: "signal", label: "Prélèvement avant 09:30", address: "4 avenue Exemple, Paris", access: "Interphone fictif 24B", acts: [{ id: "prelevement", label: "Prélèvement prescrit", detail: "Dépôt laboratoire avant 09:30" }], note: "Horaire impératif : dépôt au laboratoire avant 09:30." },
  { id: "paul", time: "09:20", window: "09:00–10:00", initials: "PV", patient: "Paul Verne", age: 83, duration: 20, status: "planned", priority: "normal", label: "Soins quotidiens", address: "7 impasse Fictive, Paris", access: "Rez-de-chaussée", acts: [{ id: "soins", label: "Soins selon le plan actif", detail: "Transmission ciblée" }], note: null },
];

const syntheticCoordinates: Record<string, [number, number]> = {
  cabinet: [0, 0], rose: [1, 0], marcel: [5, 0], ines: [2, 0], paul: [6, 0],
};

const syntheticMatrix = buildSyntheticMatrix(syntheticCoordinates);
const syntheticDepartureMinute = 7 * 60 + 22;

function Icon({ name }: { name: "route" | "clock" | "check" | "pin" | "play" | "note" | "alert" | "arrow" | "user" | "shield" | "chevron" | "lock" | "spark" }) {
  const paths = {
    route: <><circle cx="5" cy="5" r="2" /><circle cx="15" cy="15" r="2" /><path d="M7 5h3a3 3 0 0 1 0 6H8a3 3 0 0 0-3 3v1" /></>,
    clock: <><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></>,
    check: <path d="m5 10 3 3 7-7" />,
    pin: <><path d="M10 18s5-5.2 5-10a5 5 0 1 0-10 0c0 4.8 5 10 5 10Z" /><circle cx="10" cy="8" r="1.6" /></>,
    play: <path d="m7 5 8 5-8 5z" />,
    note: <><path d="M5 3h8l3 3v11H5z" /><path d="M13 3v4h4M8 10h5M8 13h5" /></>,
    alert: <><path d="M10 3 18 17H2z" /><path d="M10 8v4M10 14.5v.2" /></>,
    arrow: <path d="M4 10h11M11 6l4 4-4 4" />,
    user: <><circle cx="10" cy="7" r="3" /><path d="M4.5 17c.7-3 2.5-4.5 5.5-4.5s4.8 1.5 5.5 4.5" /></>,
    shield: <><path d="M10 2.5 16 5v4.5c0 4-2.4 6.5-6 8-3.6-1.5-6-4-6-8V5z" /><path d="m7 10 2 2 4-4" /></>,
    chevron: <path d="m8 5 5 5-5 5" />,
    lock: <><rect x="4" y="8" width="12" height="9" rx="2" /><path d="M7 8V6a3 3 0 0 1 6 0v2" /></>,
    spark: <path d="m10 2 1.2 4.3L15 8l-3.8 1.7L10 14l-1.2-4.3L5 8l3.8-1.7z" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function TodayDemo() {
  const [visits, setVisits] = useState(initialVisits);
  const [selectedId, setSelectedId] = useState("rose");
  const [mode, setMode] = useState<"tour" | "passage" | "complete" | "optimize">("tour");
  const [checkedActs, setCheckedActs] = useState<Set<string>>(new Set());
  const [lockedStops, setLockedStops] = useState<Set<string>>(new Set(["rose"]));
  const [optimizationApplied, setOptimizationApplied] = useState(false);
  const [routeGainMin, setRouteGainMin] = useState(0);
  const selected = visits.find(({ id }) => id === selectedId) ?? visits[0];
  const completed = visits.filter(({ status }) => status === "done").length;
  const remainingMinutes = visits.filter(({ status }) => status !== "done").reduce((sum, visit) => sum + visit.duration, 0);
  const nextVisit = visits.find(({ status }) => status === "planned");
  const allActsChecked = selected !== undefined && selected.acts.every(({ id }) => checkedActs.has(id));

  const endTime = useMemo(() => {
    const totalMinutes = remainingMinutes + 58 - routeGainMin;
    const end = 7 * 60 + 18 + totalMinutes;
    return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  }, [remainingMinutes, routeGainMin]);

  const routeProposal = useMemo(() => {
    const planned = visits.filter(({ status }) => status === "planned");
    return proposeRouteOptimization({
      currentOrder: planned.map(({ id }) => id),
      stops: planned.map((visit) => {
        const [start, end] = visit.window.split("–");
        return {
          id: visit.id,
          serviceDurationMin: visit.duration,
          windowStartMin: timeToMinute(start ?? "00:00"),
          windowEndMin: timeToMinute(end ?? "23:59"),
        };
      }),
      matrix: syntheticMatrix,
      startId: "cabinet",
      endId: "cabinet",
      departureMinute: syntheticDepartureMinute,
      lockedStopIds: [...lockedStops].filter((id) => planned.some((visit) => visit.id === id)),
    });
  }, [lockedStops, visits]);

  if (selected === undefined) return null;
  const selectedVisit = selected;

  function startVisit() {
    setVisits((current) => current.map((visit) => visit.id === selectedVisit.id ? { ...visit, status: "in_progress" } : visit));
    setCheckedActs(new Set());
    setMode("passage");
  }

  function completeVisit() {
    if (!allActsChecked) return;
    setVisits((current) => current.map((visit) => visit.id === selectedVisit.id ? { ...visit, status: "done" } : visit));
    setMode("complete");
  }

  function continueTour() {
    const currentIndex = visits.findIndex(({ id }) => id === selectedVisit.id);
    const following = visits.slice(currentIndex + 1).find(({ status }) => status === "planned") ?? nextVisit;
    if (following !== undefined) setSelectedId(following.id);
    setCheckedActs(new Set());
    setMode("tour");
  }

  function applyOptimization() {
    const byId = new Map(visits.map((visit) => [visit.id, visit]));
    const completedVisits = visits.filter(({ status }) => status === "done");
    const updatedEtas = calculateSyntheticEtas(routeProposal.proposedOrder, byId);
    const optimizedVisits = routeProposal.proposedOrder.flatMap((id) => {
      const visit = byId.get(id);
      return visit === undefined ? [] : [{ ...visit, time: updatedEtas.get(id) ?? visit.time }];
    });
    setVisits([...completedVisits, ...optimizedVisits]);
    setRouteGainMin(Math.round(routeProposal.durationGainS / 60));
    setOptimizationApplied(true);
    setMode("tour");
  }

  return (
    <div className="today-workspace">
      {mode === "tour" ? (
        <>
          <section className="today-heading">
            <div><span className="today-kicker">Tournée du matin</span><h1>Aujourd’hui, Emma.</h1><p>Tout ce qu’il faut pour avancer, dans l’ordre.</p></div>
            <div className="today-heading-actions"><button className="today-optimize-button" onClick={() => setMode("optimize")} type="button"><Icon name="spark" />Optimiser la tournée</button><div className="today-demo-note"><Icon name="shield" /><span><strong>Données 100 % fictives</strong>Aucune information de santé réelle</span></div></div>
          </section>

          {optimizationApplied && <div className="today-applied"><Icon name="check" /><span><strong>Nouvel ordre appliqué</strong>La tournée a été mise à jour après votre validation.</span><button onClick={() => setOptimizationApplied(false)} type="button" aria-label="Fermer">×</button></div>}

          <section className="today-stats" aria-label="Résumé de la tournée">
            <div><span className="today-stat-icon"><Icon name="route" /></span><span><strong>{completed}/{visits.length}</strong>passages terminés</span></div>
            <div><span className="today-stat-icon"><Icon name="clock" /></span><span><strong>{remainingMinutes} min</strong>de soins restants</span></div>
            <div><span className="today-stat-icon"><Icon name="alert" /></span><span><strong>1 vigilance</strong>horaire à respecter</span></div>
            <div><span className="today-stat-icon"><Icon name="pin" /></span><span><strong>{endTime}</strong>fin estimée</span></div>
          </section>

          <div className="today-dashboard-grid">
            <section className={`today-next-card priority-${selected.priority}`}>
              <div className="today-next-top"><span className="today-kicker">{selected.status === "done" ? "Passage terminé" : selected.id === nextVisit?.id ? "Prochain passage" : "Passage sélectionné"}</span><span className="today-window"><Icon name="clock" />{selected.window}</span></div>
              <div className="today-next-person"><span className={`today-big-avatar priority-${selected.priority}`}>{selected.initials}</span><span><h2>{selected.patient}</h2><small>{selected.age} ans · cas fictif</small></span><span className="today-next-time">{selected.time}</span></div>
              <div className="today-location"><Icon name="pin" /><span><strong>{selected.address}</strong>{selected.access}</span></div>
              {selected.note !== null && <div className={`today-vigilance priority-${selected.priority}`}><Icon name="alert" /><span><strong>À savoir avant d’entrer</strong>{selected.note}</span></div>}
              <div className="today-next-acts"><span>{selected.acts.length} acte{selected.acts.length > 1 ? "s" : ""} prévu{selected.acts.length > 1 ? "s" : ""}</span>{selected.acts.map(({ id, label }) => <strong key={id}><Icon name="check" />{label}</strong>)}</div>
              <div className="today-next-actions">
                <button className="today-route-button" type="button"><Icon name="route" />Voir l’itinéraire</button>
                {selected.status === "done" ? <span className="today-done-label"><Icon name="check" />Passage tracé</span> : <button className="today-start-button" onClick={startVisit} type="button"><Icon name="play" />Démarrer le passage</button>}
              </div>
            </section>

            <aside className="today-progress-card">
              <div className="today-progress-head"><div><span className="today-kicker">Progression</span><strong>{Math.round((completed / visits.length) * 100)} %</strong></div><span>{completed} terminés</span></div>
              <div className="today-progress-track"><i style={{ width: `${(completed / visits.length) * 100}%` }} /></div>
              <div className="today-time-line"><span>Départ<strong>06:28</strong></span><i /><span>Maintenant<strong>07:18</strong></span><i /><span>Fin estimée<strong>{endTime}</strong></span></div>
              <div className="today-offline"><i /><span><strong>Mode terrain prêt</strong>La tournée reste disponible hors connexion.</span></div>
            </aside>
          </div>

          <section className="today-list-card">
            <div className="today-list-heading"><div><span className="today-kicker">Ordre actuel</span><h2>Votre matinée</h2></div><span>{visits.length} patients · 100 % fictifs</span></div>
            <div className="today-list">
              {visits.map((visit, index) => (
                <button className={`today-row ${selected.id === visit.id ? "is-selected" : ""} status-${visit.status}`} key={visit.id} onClick={() => setSelectedId(visit.id)} type="button">
                  <span className="today-row-order">{visit.status === "done" ? <Icon name="check" /> : String(index + 1).padStart(2,"0")}</span>
                  <span className="today-row-time"><strong>{visit.time}</strong>{visit.window}</span>
                  <span className={`today-small-avatar priority-${visit.priority}`}>{visit.initials}</span>
                  <span className="today-row-patient"><strong>{visit.patient}</strong><small>{visit.label}</small></span>
                  <span className={`today-row-status priority-${visit.priority}`}>{visit.status === "done" ? "Terminé" : visit.id === nextVisit?.id ? "Suivant" : visit.priority === "signal" ? "Horaire impératif" : `${visit.duration} min`}</span>
                  <Icon name="chevron" />
                </button>
              ))}
            </div>
          </section>
        </>
      ) : mode === "passage" ? (
        <PassageView visit={selected} checkedActs={checkedActs} onBack={() => setMode("tour")} onCheck={(id) => setCheckedActs((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} onComplete={completeVisit} />
      ) : mode === "optimize" ? (
        <OptimizationView visits={visits.filter(({ status }) => status === "planned")} proposal={routeProposal} lockedStops={lockedStops} onBack={() => setMode("tour")} onLock={(id) => setLockedStops((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} onApply={applyOptimization} />
      ) : (
        <CompletionView visit={selected} onContinue={continueTour} />
      )}
    </div>
  );
}

function OptimizationView({ visits, proposal, lockedStops, onBack, onLock, onApply }: { visits: DemoVisit[]; proposal: ReturnType<typeof proposeRouteOptimization>; lockedStops: Set<string>; onBack: () => void; onLock: (id: string) => void; onApply: () => void }) {
  const byId = new Map(visits.map((visit) => [visit.id, visit]));
  const gainKm = proposal.distanceGainM / 1_000;
  const gainMin = Math.round(proposal.durationGainS / 60);
  return (
    <section className="optimize-shell">
      <button className="passage-back" onClick={onBack} type="button">← Retour à la tournée</button>
      <div className="optimize-heading"><div><span className="today-kicker">Proposition locale · trajets fictifs</span><h1>Une tournée plus fluide, à valider.</h1><p>Aucun patient ne bouge sans votre accord. Verrouillez les passages à conserver puis comparez.</p></div><span className="optimize-safe"><Icon name="shield" />Aucune fenêtre horaire dégradée</span></div>
      <div className="optimize-metrics">
        <div><span>Ordre actuel</span><strong>{formatKm(proposal.before.distanceM)}</strong><small>{formatMinutes(proposal.before.travelDurationS)} de trajet</small></div>
        <span className="optimize-arrow"><Icon name="arrow" /></span>
        <div className="is-proposed"><span>Proposition</span><strong>{formatKm(proposal.after.distanceM)}</strong><small>{formatMinutes(proposal.after.travelDurationS)} de trajet</small></div>
        <div className="optimize-gain"><span>Gain estimé</span><strong>−{gainKm.toLocaleString("fr-FR",{maximumFractionDigits:1})} km</strong><small>−{gainMin} min de trajet</small></div>
      </div>
      <div className="optimize-grid">
        <section className="optimize-order-card">
          <div className="optimize-card-title"><div><Icon name="route" /><span><strong>Voir les changements</strong>{proposal.movedStopIds.length} patients changent de position</span></div><span>Avant → Après</span></div>
          <div className="optimize-columns"><span>Ordre actuel</span><span>Ordre proposé</span></div>
          {proposal.currentOrder.map((currentId, index) => {
            const current = byId.get(currentId);
            const proposed = byId.get(proposal.proposedOrder[index] ?? "");
            if (current === undefined || proposed === undefined) return null;
            return <div className="optimize-diff-row" key={currentId}><RoutePerson visit={current} index={index} moved={proposal.proposedOrder[index] !== currentId} /><span className="optimize-row-arrow">→</span><RoutePerson visit={proposed} index={index} moved={proposal.proposedOrder[index] !== currentId} /></div>;
          })}
        </section>
        <aside className="optimize-lock-card"><span className="today-kicker">Vos contraintes</span><h2>Passages verrouillés</h2><p>Un passage verrouillé garde exactement sa place.</p><div className="optimize-lock-list">{visits.map((visit) => <button className={lockedStops.has(visit.id) ? "is-locked" : ""} key={visit.id} onClick={() => onLock(visit.id)} type="button"><Icon name="lock" /><span><strong>{visit.patient}</strong>{lockedStops.has(visit.id) ? "Position conservée" : "Peut être déplacé"}</span></button>)}</div><div className="optimize-honesty"><Icon name="alert" /><span><strong>Estimation honnête</strong>Matrice fictive dans la démo. En production : OSRM auto-hébergé.</span></div></aside>
      </div>
      <div className="optimize-actions"><button onClick={onBack} type="button">Ignorer</button><button className="is-primary" disabled={proposal.movedStopIds.length === 0} onClick={onApply} type="button"><Icon name="check" />Appliquer cette proposition</button></div>
    </section>
  );
}

function RoutePerson({ visit, index, moved }: { visit: DemoVisit; index: number; moved: boolean }) {
  return <div className={`optimize-person ${moved ? "is-moved" : ""}`}><span>{index + 1}</span><span className={`today-small-avatar priority-${visit.priority}`}>{visit.initials}</span><span><strong>{visit.patient}</strong><small>{visit.window}</small></span></div>;
}

function PassageView({ visit, checkedActs, onBack, onCheck, onComplete }: { visit: DemoVisit; checkedActs: Set<string>; onBack: () => void; onCheck: (id: string) => void; onComplete: () => void }) {
  const complete = visit.acts.every(({ id }) => checkedActs.has(id));
  return (
    <section className="passage-shell">
      <button className="passage-back" onClick={onBack} type="button">← Retour à la tournée</button>
      <div className="passage-header">
        <div><span className="today-kicker">Passage en cours · démarré à 07:18</span><h1>{visit.patient}</h1><p>{visit.address} · {visit.access}</p></div>
        <div className="passage-live"><i /> En cours</div>
      </div>
      <div className="passage-grid">
        <div className="passage-main">
          {visit.note !== null && <div className={`today-vigilance priority-${visit.priority}`}><Icon name="alert" /><span><strong>Point de vigilance</strong>{visit.note}</span></div>}
          <section className="passage-checklist">
            <div className="passage-section-title"><span className="today-stat-icon"><Icon name="check" /></span><span><strong>Actes à réaliser</strong>{checkedActs.size}/{visit.acts.length} confirmés</span></div>
            {visit.acts.map((act) => {
              const checked = checkedActs.has(act.id);
              return <button aria-pressed={checked} className={`passage-act ${checked ? "is-checked" : ""}`} key={act.id} onClick={() => onCheck(act.id)} type="button"><span className="passage-act-check"><Icon name="check" /></span><span><strong>{act.label}</strong><small>{act.detail}</small></span></button>;
            })}
          </section>
          <section className="passage-context"><div className="passage-section-title"><span className="today-stat-icon"><Icon name="note" /></span><span><strong>Relève utile</strong>Dernière transmission validée</span></div><p>Rougeur périphérique stable au dernier passage. La patiente rapporte une nuit plus confortable.</p><Link href="/demo-transmissions">Voir la relève complète <Icon name="arrow" /></Link></section>
        </div>
        <aside className="passage-side">
          <span className={`today-big-avatar priority-${visit.priority}`}>{visit.initials}</span><h2>{visit.patient}</h2><p>{visit.age} ans · cas fictif</p>
          <div><span>Fenêtre prévue</span><strong>{visit.window}</strong></div><div><span>Durée estimée</span><strong>{visit.duration} min</strong></div>
          <div className="passage-secure"><Icon name="shield" /><span>Actions horodatées et visibles par le cabinet.</span></div>
        </aside>
      </div>
      <div className="passage-bottom"><span>{complete ? "Tous les actes sont confirmés." : "Confirmez chaque acte pour terminer."}</span><button disabled={!complete} onClick={onComplete} type="button"><Icon name="check" />Terminer le passage</button></div>
    </section>
  );
}

function CompletionView({ visit, onContinue }: { visit: DemoVisit; onContinue: () => void }) {
  return (
    <section className="passage-complete">
      <div className="passage-complete-icon"><Icon name="check" /></div><span className="today-kicker">Passage terminé à 07:48</span><h1>{visit.patient} est à jour.</h1><p>Les {visit.acts.length} actes ont été confirmés. Il reste à transmettre les éléments utiles à l’équipe.</p>
      <div className="passage-complete-summary"><span><Icon name="clock" /><strong>30 min</strong>durée du passage</span><span><Icon name="check" /><strong>{visit.acts.length}/{visit.acts.length}</strong>actes confirmés</span><span><Icon name="shield" /><strong>Traçabilité</strong>enregistrée</span></div>
      <div className="passage-complete-actions"><button onClick={onContinue} type="button">Patient suivant</button><Link href="/demo-transmissions"><Icon name="note" />Faire la transmission</Link></div>
      <button className="passage-back-tour" onClick={onContinue} type="button">Retourner à la tournée</button>
    </section>
  );
}

function buildSyntheticMatrix(coordinates: Record<string, [number, number]>): TravelMatrix {
  const matrix: TravelMatrix = {};
  for (const [from, fromPoint] of Object.entries(coordinates)) {
    const row: Record<string, { distanceM: number; durationS: number }> = {};
    matrix[from] = row;
    for (const [to, toPoint] of Object.entries(coordinates)) {
      if (from === to) continue;
      const units = Math.hypot(toPoint[0] - fromPoint[0], toPoint[1] - fromPoint[1]);
      row[to] = { distanceM: Math.round(units * 1_700), durationS: Math.round(units * 180) };
    }
  }
  return matrix;
}

function timeToMinute(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function formatKm(value: number): string {
  return `${(value / 1_000).toLocaleString("fr-FR",{maximumFractionDigits:1})} km`;
}

function formatMinutes(value: number): string {
  return `${Math.round(value / 60)} min`;
}

function calculateSyntheticEtas(order: string[], visits: Map<string, DemoVisit>): Map<string, string> {
  const etas = new Map<string, string>();
  let previousId = "cabinet";
  let minute = syntheticDepartureMinute;
  for (const id of order) {
    const visit = visits.get(id);
    const travel = syntheticMatrix[previousId]?.[id];
    if (visit === undefined || travel === undefined) continue;
    minute += travel.durationS / 60;
    const start = timeToMinute(visit.window.split("–")[0] ?? "00:00");
    minute = Math.max(minute, start);
    etas.set(id, minuteToTime(minute));
    minute += visit.duration;
    previousId = id;
  }
  return etas;
}

function minuteToTime(value: number): string {
  const rounded = Math.round(value);
  return `${String(Math.floor(rounded / 60)).padStart(2,"0")}:${String(rounded % 60).padStart(2,"0")}`;
}
