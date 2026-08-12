"use client";

import { useMemo, useState } from "react";

type Priority = "normal" | "watch" | "signal";
type PatientHandover = {
  id: string;
  initials: string;
  name: string;
  age: number;
  nextVisit: string;
  visitLabel: string;
  priority: Priority;
  headline: string;
  lastAuthor: string;
  lastTime: string;
  access: string;
  carePlan: string[];
  observations: string[];
  acts: string[];
  vitals: Array<{ label: string; value: string; trend?: string }>;
  concerns: Array<{ label: string; level: Priority }>;
  nextNotes: string[];
  history: Array<{ date: string; author: string; summary: string }>;
};

const patients: PatientHandover[] = [
  {
    id: "rose",
    initials: "RC",
    name: "Rose Carmin",
    age: 78,
    nextVisit: "06:45",
    visitLabel: "Passage du matin",
    priority: "watch",
    headline: "Pansement à surveiller",
    lastAuthor: "Claire M.",
    lastTime: "Hier · 18:42",
    access: "Résidence fictive Les Tilleuls · Bât. B · 2e étage",
    carePlan: ["Pansement complexe", "Surveillance de la douleur", "Traitement préparé selon l’ordonnance"],
    observations: [
      "Rougeur périphérique stable par rapport au passage précédent.",
      "La patiente rapporte une nuit plus confortable.",
    ],
    acts: ["Pansement refait selon le protocole", "Évaluation de la douleur réalisée"],
    vitals: [
      { label: "Douleur EVA", value: "3/10", trend: "−1" },
      { label: "Température", value: "37,2 °C" },
    ],
    concerns: [{ label: "Contrôler l’évolution de la rougeur", level: "watch" }],
    nextNotes: ["Prévoir le kit de pansement n° 2.", "Vérifier si la douleur reste inférieure à 4/10."],
    history: [
      { date: "Hier · 08:11", author: "Nadia L.", summary: "Pansement propre, douleur évaluée à 4/10." },
      { date: "Lun. · 18:36", author: "Claire M.", summary: "Rougeur stable, aucun élément nouveau signalé." },
    ],
  },
  {
    id: "marcel",
    initials: "MD",
    name: "Marcel Dune",
    age: 71,
    nextVisit: "07:20",
    visitLabel: "Passage du matin",
    priority: "normal",
    headline: "Traitement habituel",
    lastAuthor: "Nadia L.",
    lastTime: "Hier · 19:08",
    access: "12 rue Démonstration · Maison fictive, portail gris",
    carePlan: ["Surveillance glycémique", "Administration selon prescription", "Traçabilité du passage"],
    observations: ["Patient de bonne humeur, repas du soir pris normalement."],
    acts: ["Glycémie capillaire réalisée", "Administration réalisée selon prescription"],
    vitals: [{ label: "Glycémie", value: "1,18 g/L", trend: "stable" }],
    concerns: [],
    nextNotes: ["Le matériel est dans le tiroir supérieur de la desserte."],
    history: [
      { date: "Hier · 07:24", author: "Claire M.", summary: "Passage habituel, aucun changement rapporté." },
      { date: "Lun. · 19:02", author: "Nadia L.", summary: "Glycémie tracée, soin réalisé conformément au plan." },
    ],
  },
  {
    id: "ines",
    initials: "IB",
    name: "Inès Brume",
    age: 64,
    nextVisit: "08:05",
    visitLabel: "Prélèvement",
    priority: "signal",
    headline: "Laboratoire avant 09:30",
    lastAuthor: "Claire M.",
    lastTime: "Hier · 17:55",
    access: "4 avenue Exemple · Interphone fictif 24B",
    carePlan: ["Prélèvement prescrit", "Dépôt au laboratoire avant 09:30"],
    observations: ["Patiente prévenue de l’horaire avancé du passage."],
    acts: ["Préparation du matériel confirmée"],
    vitals: [],
    concerns: [{ label: "Échantillon à déposer avant 09:30", level: "signal" }],
    nextNotes: ["Ordonnance et étiquettes dans la pochette bleue fictive."],
    history: [
      { date: "Lun. · 17:48", author: "Nadia L.", summary: "Rendez-vous confirmé pour mercredi matin." },
    ],
  },
  {
    id: "paul",
    initials: "PV",
    name: "Paul Verne",
    age: 83,
    nextVisit: "08:50",
    visitLabel: "Soins quotidiens",
    priority: "normal",
    headline: "Relève à consulter",
    lastAuthor: "Nadia L.",
    lastTime: "Hier · 18:16",
    access: "7 impasse Fictive · Rez-de-chaussée",
    carePlan: ["Soins quotidiens", "Surveillance générale", "Transmission ciblée"],
    observations: ["Le patient rapporte un bon appétit."],
    acts: ["Soins réalisés conformément au plan"],
    vitals: [{ label: "Tension", value: "128/76" }],
    concerns: [],
    nextNotes: ["Son fils fictif sera présent au passage du matin."],
    history: [
      { date: "Hier · 08:47", author: "Claire M.", summary: "Tension tracée, état habituel." },
    ],
  },
];

const demoTranscript = "Pansement refait selon le protocole. Rougeur stable observée autour de la plaie. La patiente rapporte une douleur à 3 sur 10. Température 37,2. Prévoir le kit numéro 2 demain matin et contrôler la rougeur.";

function Icon({ name }: { name: "check" | "clock" | "mic" | "note" | "user" | "pulse" | "alert" | "history" | "spark" | "arrow" }) {
  const paths = {
    check: <path d="m5 10 3 3 7-7" />,
    clock: <><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></>,
    mic: <><rect x="7" y="3" width="6" height="10" rx="3" /><path d="M4.5 10a5.5 5.5 0 0 0 11 0M10 15.5V18M7.5 18h5" /></>,
    note: <><path d="M5 3h8l3 3v11H5z" /><path d="M13 3v4h4M8 10h5M8 13h5" /></>,
    user: <><circle cx="10" cy="7" r="3" /><path d="M4.5 17c.7-3 2.5-4.5 5.5-4.5s4.8 1.5 5.5 4.5" /></>,
    pulse: <path d="M2 11h4l2-5 3.5 9 2.5-5h4" />,
    alert: <><path d="M10 3 18 17H2z" /><path d="M10 8v4M10 14.5v.2" /></>,
    history: <><path d="M4 6V2M4 6h4" /><path d="M4.5 5.5A7 7 0 1 1 3 13" /><path d="M10 6v4l3 2" /></>,
    spark: <path d="m10 2 1.2 4.3L15 8l-3.8 1.7L10 14l-1.2-4.3L5 8l3.8-1.7z" />,
    arrow: <path d="M4 10h11M11 6l4 4-4 4" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function buildSyntheticStructure(text: string) {
  const lowered = text.toLocaleLowerCase("fr");
  const acts = [
    lowered.includes("pansement") ? "Pansement refait selon le protocole" : null,
    lowered.includes("glycémie") ? "Glycémie capillaire réalisée" : null,
  ].filter((value): value is string => value !== null);
  const vitals: Array<{ label: string; value: string }> = [];
  const temperature = text.match(/température\s+(\d{2}[,.]\d)/i)?.[1];
  const pain = text.match(/douleur\s+(?:à\s+)?(\d{1,2})\s+(?:sur|\/)?\s*10/i)?.[1];
  if (pain !== undefined) vitals.push({ label: "Douleur EVA", value: `${pain}/10` });
  if (temperature !== undefined) vitals.push({ label: "Température", value: `${temperature.replace(",", ".")} °C` });
  return {
    acts,
    observations: lowered.includes("rougeur") ? ["Rougeur stable observée autour de la plaie."] : ["Observation à relire avant validation."],
    vitals,
    concern: lowered.includes("contrôler") || lowered.includes("surveiller") ? "Contrôler l’évolution au prochain passage." : null,
    next: lowered.includes("prévoir") ? "Prévoir le matériel mentionné pour le prochain passage." : null,
  };
}

export function HandoverDemo() {
  const [selectedId, setSelectedId] = useState(patients[0]?.id ?? "");
  const [tab, setTab] = useState<"handover" | "history">("handover");
  const [readPatients, setReadPatients] = useState<Set<string>>(new Set(["marcel"]));
  const [composerOpen, setComposerOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [structured, setStructured] = useState<ReturnType<typeof buildSyntheticStructure> | null>(null);
  const [saved, setSaved] = useState(false);
  const patient = patients.find(({ id }) => id === selectedId) ?? patients[0];
  const readCount = patients.filter(({ id }) => readPatients.has(id)).length;
  const structure = useMemo(() => structured, [structured]);

  if (patient === undefined) return null;
  const currentPatientId = patient.id;

  function acknowledge() {
    setReadPatients((current) => new Set(current).add(currentPatientId));
  }

  function selectPatient(id: string) {
    setSelectedId(id);
    setTab("handover");
    setComposerOpen(false);
    setStructured(null);
    setSaved(false);
  }

  return (
    <div className="handover-layout">
      <aside className="handover-sidebar">
        <div className="handover-side-heading">
          <div>
            <span className="handover-kicker">Relève du cabinet</span>
            <h1>Bonjour Emma</h1>
          </div>
          <span className="handover-date">Mer. 12 août</span>
        </div>

        <div className="handover-progress">
          <div><strong>{readCount}/{patients.length}</strong><span>relèves consultées</span></div>
          <div className="handover-progress-track"><i style={{ width: `${(readCount / patients.length) * 100}%` }} /></div>
        </div>

        <div className="handover-filter-row">
          <strong>Patients du matin</strong>
          <span>{patients.length} passages</span>
        </div>

        <div className="handover-patient-list">
          {patients.map((item) => {
            const isRead = readPatients.has(item.id);
            return (
              <button
                className={`handover-patient ${selectedId === item.id ? "is-selected" : ""}`}
                key={item.id}
                onClick={() => selectPatient(item.id)}
                type="button"
              >
                <span className="handover-time">{item.nextVisit}</span>
                <span className={`handover-patient-avatar priority-${item.priority}`}>{item.initials}</span>
                <span className="handover-patient-copy">
                  <strong>{item.name}</strong>
                  <span>{item.headline}</span>
                </span>
                {!isRead && <i className={`handover-unread priority-${item.priority}`} aria-label="Relève non consultée" />}
              </button>
            );
          })}
        </div>

        <div className="handover-confidentiality"><Icon name="check" /><span><strong>Démo locale et fictive</strong>Aucune donnée de santé réelle</span></div>
      </aside>

      <section className="handover-main">
        <header className="handover-patient-header">
          <div className={`handover-big-avatar priority-${patient.priority}`}>{patient.initials}</div>
          <div className="handover-patient-title">
            <div><h2>{patient.name}</h2><span>{patient.age} ans · Cas fictif</span></div>
            <div className="handover-next"><Icon name="clock" /><span>Prochain passage<strong>{patient.nextVisit}</strong></span></div>
          </div>
          <button className="handover-new-button" onClick={() => setComposerOpen(true)} type="button"><Icon name="mic" />Nouvelle transmission</button>
        </header>

        <div className="handover-tabs" role="tablist" aria-label="Contenu du dossier">
          <button className={tab === "handover" ? "is-active" : ""} onClick={() => setTab("handover")} role="tab" type="button">Relève à lire</button>
          <button className={tab === "history" ? "is-active" : ""} onClick={() => setTab("history")} role="tab" type="button">Historique <span>{patient.history.length + 1}</span></button>
        </div>

        {composerOpen ? (
          <section className="handover-composer">
            <div className="handover-composer-head">
              <div className="handover-section-icon"><Icon name="mic" /></div>
              <div><span className="handover-kicker">Nouvelle transmission</span><h3>Dictez naturellement, IDEL OS structure.</h3></div>
              <button className="handover-close" onClick={() => setComposerOpen(false)} type="button" aria-label="Fermer">×</button>
            </div>
            <div className="handover-safety-note"><Icon name="alert" /><span>Dans cette démonstration, utilisez uniquement le texte fictif proposé. La transcription audio réelle sera activée sur l’infrastructure HDS.</span></div>
            <label className="handover-transcript-field">
              <span>Transcription brute</span>
              <textarea
                onChange={(event) => { setTranscript(event.target.value); setStructured(null); setSaved(false); }}
                placeholder="Votre dictée apparaîtra ici…"
                value={transcript}
              />
            </label>
            <div className="handover-composer-actions">
              <button className="handover-demo-dictation" onClick={() => { setTranscript(demoTranscript); setStructured(null); setSaved(false); }} type="button"><Icon name="mic" />Utiliser une dictée fictive</button>
              <button className="handover-structure-button" disabled={transcript.trim().length === 0} onClick={() => setStructured(buildSyntheticStructure(transcript))} type="button"><Icon name="spark" />Structurer la transmission</button>
            </div>
            {structure !== null && (
              <div className="handover-structured-preview">
                <div className="handover-preview-title"><div><Icon name="spark" /><span><strong>Proposition structurée</strong>À relire avant validation</span></div><span className="handover-ai-label">Automatique</span></div>
                <div className="handover-preview-grid">
                  <PreviewSection title="Actes réalisés" items={structure.acts} />
                  <PreviewSection title="Observations" items={structure.observations} />
                  <PreviewSection title="Constantes" items={structure.vitals.map(({ label, value }) => `${label} : ${value}`)} />
                  <PreviewSection title="Prochain passage" items={[structure.concern, structure.next].filter((value): value is string => value !== null)} />
                </div>
                <button className={`handover-validate-button ${saved ? "is-saved" : ""}`} onClick={() => setSaved(true)} type="button"><Icon name="check" />{saved ? "Transmission validée dans la démo" : "Relire et valider"}</button>
              </div>
            )}
          </section>
        ) : tab === "handover" ? (
          <div className="handover-content-grid">
            <div className="handover-content-primary">
              <section className="handover-brief-card">
                <div className="handover-card-heading"><div className="handover-section-icon"><Icon name="note" /></div><div><span className="handover-kicker">Avant le passage</span><h3>Ce qu’il faut savoir</h3></div></div>
                <div className="handover-access"><Icon name="user" /><div><span>Accès patient</span><strong>{patient.access}</strong></div></div>
                <div className="handover-care-list">
                  {patient.carePlan.map((care) => <div key={care}><span><Icon name="check" /></span>{care}</div>)}
                </div>
              </section>

              <section className="handover-transmission-card">
                <div className="handover-transmission-meta">
                  <div><span className="handover-author-avatar">CM</span><span><strong>Transmission de {patient.lastAuthor}</strong><small>{patient.lastTime} · Validée</small></span></div>
                  <span className="handover-validated"><Icon name="check" />Validée</span>
                </div>
                <TransmissionSection icon="check" title="Actes réalisés" items={patient.acts} />
                <TransmissionSection icon="note" title="Observations" items={patient.observations} />
                {patient.vitals.length > 0 && <div className="handover-vitals">{patient.vitals.map((vital) => <div key={vital.label}><span>{vital.label}</span><strong>{vital.value}</strong>{vital.trend && <small>{vital.trend}</small>}</div>)}</div>}
                {patient.concerns.length > 0 && <div className={`handover-concern priority-${patient.concerns[0]?.level ?? "normal"}`}><Icon name="alert" /><span><strong>Point de vigilance</strong>{patient.concerns[0]?.label}</span></div>}
                <TransmissionSection icon="arrow" title="Pour le prochain passage" items={patient.nextNotes} />
              </section>
            </div>

            <aside className="handover-summary-card">
              <div className="handover-summary-top"><span className={`handover-summary-status priority-${patient.priority}`}>{patient.priority === "normal" ? "Routine" : patient.priority === "watch" ? "À surveiller" : "À signaler"}</span><span>{patient.visitLabel}</span></div>
              <h3>Relève comprise ?</h3>
              <p>Confirmez que vous avez pris connaissance des informations avant le passage.</p>
              <button className={`handover-read-button ${readPatients.has(patient.id) ? "is-read" : ""}`} onClick={acknowledge} type="button"><Icon name="check" />{readPatients.has(patient.id) ? "Relève consultée" : "Marquer comme lue"}</button>
              <div className="handover-summary-divider" />
              <span className="handover-summary-label">Dernière mise à jour</span>
              <div className="handover-author-row"><span className="handover-author-avatar">CM</span><span><strong>{patient.lastAuthor}</strong><small>{patient.lastTime}</small></span></div>
              <div className="handover-team-note"><Icon name="pulse" /><span>Les validations sont visibles par toute l’équipe du cabinet.</span></div>
            </aside>
          </div>
        ) : (
          <section className="handover-history-card">
            <div className="handover-card-heading"><div className="handover-section-icon"><Icon name="history" /></div><div><span className="handover-kicker">Chronologie</span><h3>Historique des transmissions</h3></div></div>
            <div className="handover-timeline">
              <div className="handover-timeline-item is-current"><i /><div><span>{patient.lastTime}</span><strong>{patient.lastAuthor}</strong><p>{patient.headline}. Transmission structurée et validée.</p></div></div>
              {patient.history.map((entry) => <div className="handover-timeline-item" key={`${entry.date}-${entry.author}`}><i /><div><span>{entry.date}</span><strong>{entry.author}</strong><p>{entry.summary}</p></div></div>)}
            </div>
          </section>
        )}
      </section>
    </div>
  );
}

function TransmissionSection({ icon, title, items }: { icon: "check" | "note" | "arrow"; title: string; items: string[] }) {
  return <div className="handover-transmission-section"><div className="handover-transmission-label"><Icon name={icon} />{title}</div><div>{items.map((item) => <p key={item}>{item}</p>)}</div></div>;
}

function PreviewSection({ title, items }: { title: string; items: string[] }) {
  return <div><span>{title}</span>{items.length > 0 ? items.map((item) => <p key={item}>{item}</p>) : <p className="is-empty">Aucune information détectée</p>}</div>;
}
