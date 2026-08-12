"use client";

import { generateVisitSchedule, type PlannedVisit } from "@idel-os/routing";
import { useMemo, useState } from "react";

type Stage = "review" | "schedule" | "complete";
type ReviewKey = "pansement" | "traitement" | "dates";

const scheduleInput = {
  patientId: "patient-fictif-louise-ambre",
  startDate: "2026-08-13",
  endDate: "2026-08-26",
  items: [
    {
      id: "pansement",
      label: "Pansement de plaie non chirurgicale",
      estimatedDurationMin: 20,
      frequency: {
        kind: "daily" as const,
        timesPerDay: 1,
        everyNDays: 1,
        timeWindows: [{ start: "07:00", end: "09:00" }],
      },
    },
    {
      id: "traitement",
      label: "Administration médicamenteuse selon prescription",
      estimatedDurationMin: 10,
      frequency: {
        kind: "daily" as const,
        timesPerDay: 2,
        everyNDays: 1,
        timeWindows: [
          { start: "06:30", end: "08:30" },
          { start: "18:00", end: "20:00" },
        ],
      },
    },
  ],
};

const reviewItems: Array<{
  key: ReviewKey;
  label: string;
  value: string;
  detail: string;
  confidence: number;
}> = [
  {
    key: "pansement",
    label: "Soin 1",
    value: "Pansement de plaie non chirurgicale",
    detail: "1 fois par jour · pendant 14 jours",
    confidence: 98,
  },
  {
    key: "traitement",
    label: "Soin 2",
    value: "Administration médicamenteuse selon prescription",
    detail: "Matin et soir · pendant 14 jours",
    confidence: 94,
  },
  {
    key: "dates",
    label: "Période prescrite",
    value: "Du 13 au 26 août 2026",
    detail: "14 jours · début le lendemain de la prescription",
    confidence: 97,
  },
];

function Icon({ name }: { name: "check" | "document" | "calendar" | "shield" | "arrow" | "clock" | "spark" | "edit" }) {
  const paths = {
    check: <path d="m5 10 3 3 7-7" />,
    document: <><path d="M5 2.5h7l3 3v12H5z" /><path d="M12 2.5v4h4M8 10h4M8 13h4" /></>,
    calendar: <><rect x="3" y="4.5" width="14" height="12.5" rx="2" /><path d="M6.5 2.5v4M13.5 2.5v4M3 8h14" /></>,
    shield: <><path d="M10 2.5 16 5v4.5c0 4-2.4 6.5-6 8-3.6-1.5-6-4-6-8V5z" /><path d="m7 10 2 2 4-4" /></>,
    arrow: <path d="M4 10h11M11 6l4 4-4 4" />,
    clock: <><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></>,
    spark: <path d="m10 2 1.2 4.3L15 8l-3.8 1.7L10 14l-1.2-4.3L5 8l3.8-1.7z" />,
    edit: <><path d="m5 15 1-4 7-7 3 3-7 7z" /><path d="M11.5 5.5 14.5 8.5M4 17h12" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function PrescriptionDemo() {
  const [stage, setStage] = useState<Stage>("review");
  const [reviewed, setReviewed] = useState<Set<ReviewKey>>(new Set());
  const visits = useMemo(() => generateVisitSchedule(scheduleInput), []);
  const reviewComplete = reviewed.size === reviewItems.length;

  function toggleReview(key: ReviewKey) {
    setReviewed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="rx-workspace">
      <header className="rx-heading">
        <div>
          <span className="rx-kicker">Ordonnance vers tournée</span>
          <h1>Une ordonnance relue.<br />Des passages prêts.</h1>
          <p>IDEL OS extrait et organise. Vous contrôlez chaque information avant la création du plan.</p>
        </div>
        <div className="rx-safety"><Icon name="shield" /><span><strong>Aucune décision automatique</strong>La validation reste celle du professionnel</span></div>
      </header>

      <ol className="rx-steps" aria-label="Progression">
        <Step active={stage === "review"} complete={stage !== "review"} index="01" label="Relire l’extraction" />
        <Step active={stage === "schedule"} complete={stage === "complete"} index="02" label="Vérifier les passages" />
        <Step active={stage === "complete"} complete={stage === "complete"} index="03" label="Ajouter au planning" />
      </ol>

      {stage === "review" && (
        <div className="rx-review-grid">
          <SyntheticPrescription />
          <section className="rx-review-panel">
            <div className="rx-panel-heading">
              <div><span className="rx-kicker">Extraction locale fictive</span><h2>Vérifiez les informations détectées</h2></div>
              <span className="rx-ai-pill"><Icon name="spark" /> Proposition automatique</span>
            </div>
            <div className="rx-patient-summary">
              <span className="rx-avatar">LA</span>
              <span><strong>Louise Ambre</strong><small>Patiente fictive · dossier de démonstration</small></span>
            </div>
            <div className="rx-review-list">
              {reviewItems.map((item) => {
                const isReviewed = reviewed.has(item.key);
                return (
                  <button
                    className={`rx-review-item ${isReviewed ? "is-reviewed" : ""}`}
                    key={item.key}
                    onClick={() => toggleReview(item.key)}
                    type="button"
                    aria-pressed={isReviewed}
                  >
                    <span className="rx-review-check"><Icon name="check" /></span>
                    <span className="rx-review-copy"><small>{item.label}</small><strong>{item.value}</strong><span>{item.detail}</span></span>
                    <span className="rx-confidence">{item.confidence} %<small>confiance</small></span>
                  </button>
                );
              })}
            </div>
            <div className="rx-review-footer">
              <span>{reviewComplete ? "Les 3 éléments ont été relus." : `${reviewed.size}/3 éléments confirmés`}</span>
              <button className="rx-primary-button" disabled={!reviewComplete} onClick={() => setStage("schedule")} type="button">Valider l’extraction <Icon name="arrow" /></button>
            </div>
          </section>
        </div>
      )}

      {stage === "schedule" && (
        <ScheduleReview visits={visits} onBack={() => setStage("review")} onConfirm={() => setStage("complete")} />
      )}

      {stage === "complete" && <CompleteState visits={visits} onRestart={() => { setReviewed(new Set()); setStage("review"); }} />}
    </div>
  );
}

function Step({ active, complete, index, label }: { active: boolean; complete: boolean; index: string; label: string }) {
  return <li className={`${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}><span>{complete ? <Icon name="check" /> : index}</span><strong>{label}</strong></li>;
}

function SyntheticPrescription() {
  return (
    <aside className="rx-document-column">
      <div className="rx-document-toolbar"><span><Icon name="document" /> Ordonnance fictive</span><span>1 page</span></div>
      <article className="rx-document">
        <div className="rx-document-logo">Cabinet médical fictif</div>
        <div className="rx-document-prescriber"><strong>Dr Élise Exemple</strong><span>Médecine générale · Identité fictive</span><span>8 avenue de la Démonstration</span></div>
        <div className="rx-document-date">Paris, le 12 août 2026</div>
        <div className="rx-document-patient">Pour Mme <strong>Louise Ambre</strong><br />Née le 04/03/1952 · cas fictif</div>
        <div className="rx-document-care">
          <p><strong>Faire pratiquer à domicile par IDE :</strong></p>
          <p>Pansement de plaie non chirurgicale<br /><u>1 fois par jour pendant 14 jours</u></p>
          <p>Administration médicamenteuse selon protocole joint<br /><u>matin et soir pendant 14 jours</u></p>
          <p>À débuter le 13 août 2026.</p>
        </div>
        <div className="rx-document-signature">Signature fictive</div>
        <div className="rx-document-watermark">DOCUMENT SYNTHÉTIQUE</div>
      </article>
      <div className="rx-local-note"><Icon name="shield" /><span><strong>Traitement local de démonstration</strong>Aucun document ni nom réel n’est envoyé.</span></div>
    </aside>
  );
}

function ScheduleReview({ visits, onBack, onConfirm }: { visits: PlannedVisit[]; onBack: () => void; onConfirm: () => void }) {
  const grouped = groupVisits(visits).slice(0, 4);
  const totalMinutes = visits.reduce((sum, visit) => sum + visit.estimatedDurationMin, 0);
  return (
    <section className="rx-schedule-panel">
      <div className="rx-schedule-hero">
        <div><span className="rx-kicker">Plan de soins proposé</span><h2>{visits.length} passages générés, à vérifier.</h2><p>Les horaires sont des fenêtres de passage. La tournée pourra les ordonner sans les modifier silencieusement.</p></div>
        <div className="rx-metrics">
          <span><strong>14</strong>jours</span>
          <span><strong>{visits.length}</strong>passages</span>
          <span><strong>{Math.round(totalMinutes / 60)} h</strong>de soins estimés</span>
        </div>
      </div>
      <div className="rx-schedule-content">
        <div className="rx-schedule-days">
          <div className="rx-section-title"><Icon name="calendar" /><span><strong>Aperçu des prochains passages</strong>4 premiers jours affichés</span></div>
          {grouped.map(([date, dayVisits]) => (
            <div className="rx-day" key={date}>
              <div className="rx-day-date"><strong>{formatDay(date)}</strong><span>{dayVisits.length} passages</span></div>
              <div className="rx-day-visits">
                {dayVisits.map((visit) => <div className="rx-visit" key={visit.id}><span><Icon name="clock" />{visit.timeWindow.start}–{visit.timeWindow.end}</span><strong>{visit.careItems.map(({ label }) => label).join(" + ")}</strong><small>{visit.careItems.length} acte{visit.careItems.length > 1 ? "s" : ""} · {visit.estimatedDurationMin} min</small></div>)}
              </div>
            </div>
          ))}
          <div className="rx-more-days">+ 10 jours supplémentaires déjà préparés</div>
        </div>
        <aside className="rx-plan-summary">
          <span className="rx-kicker">Ce qui sera créé</span>
          <h3>Plan « Soins août »</h3>
          <ul>
            <li><Icon name="check" />2 soins issus de l’ordonnance</li>
            <li><Icon name="check" />{visits.length} passages · 42 actes</li>
            <li><Icon name="check" />Fenêtres matin et soir conservées</li>
            <li><Icon name="check" />Historique et validation tracés</li>
          </ul>
          <div className="rx-warning"><Icon name="edit" /><span><strong>Encore modifiable</strong>Aucun passage réel n’est créé dans cette démonstration.</span></div>
        </aside>
      </div>
      <div className="rx-schedule-actions"><button className="rx-secondary-button" onClick={onBack} type="button">Revenir à l’extraction</button><button className="rx-primary-button" onClick={onConfirm} type="button">Créer le plan et les passages <Icon name="arrow" /></button></div>
    </section>
  );
}

function CompleteState({ visits, onRestart }: { visits: PlannedVisit[]; onRestart: () => void }) {
  return (
    <section className="rx-complete">
      <div className="rx-complete-icon"><Icon name="check" /></div>
      <span className="rx-kicker">Démonstration terminée</span>
      <h2>Le plan est prêt pour la tournée.</h2>
      <p>{visits.length} passages fictifs ont été préparés après revue humaine. Dans la version HDS, cette validation sera horodatée et liée au professionnel.</p>
      <div className="rx-complete-flow"><span>Ordonnance relue<Icon name="check" /></span><i /><span>Plan de soins<Icon name="check" /></span><i /><span>Passages prêts<Icon name="check" /></span></div>
      <div className="rx-complete-actions">
        <button className="rx-secondary-button" onClick={onRestart} type="button">Rejouer la démonstration</button>
        <a className="rx-primary-button" href="/demo-cotation">Vérifier la cotation <Icon name="arrow" /></a>
      </div>
    </section>
  );
}

function groupVisits(visits: PlannedVisit[]): Array<[string, PlannedVisit[]]> {
  const groups = new Map<string, PlannedVisit[]>();
  for (const visit of visits) groups.set(visit.date, [...(groups.get(visit.date) ?? []), visit]);
  return [...groups.entries()];
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00Z`));
}
