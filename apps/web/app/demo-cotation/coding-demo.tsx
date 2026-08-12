"use client";

import { evaluate } from "@idel-os/ngap-engine";
import type { CodingContext, CodingResult } from "@idel-os/ngap-engine";
import { useMemo, useState } from "react";

type ActChoice = CodingContext["acts"][number]["catalogId"];

const actOptions: Array<{ id: ActChoice; label: string }> = [
  { id: "pansement-non-chirurgical", label: "Pansement de plaie non chirurgicale" },
  { id: "pansement-chirurgical-simple", label: "Pansement chirurgical simple" },
  { id: "administration-medicamenteuse", label: "Administration médicamenteuse à domicile" },
];

function formatMoney(amountCents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    amountCents / 100,
  );
}

function buildContext(
  actId: ActChoice,
  options: { home: boolean; sunday: boolean; night: boolean; child: boolean },
): CodingContext {
  const date = new Date("2026-08-12T08:00:00.000Z");
  return {
    patient: { isALD: false, isDiabetic: false, age: options.child ? 6 : 42 },
    visit: {
      at: date,
      isSunday: options.sunday,
      isHoliday: false,
      isNight: options.night,
      ...(options.night ? { nightPeriod: "20-23_or_5-8" as const } : {}),
      isHomeVisit: options.home,
    },
    acts: [{ catalogId: actId, quantity: 1, tags: [] }],
    travel: { fromCabinetKm: options.home ? 3 : 0, zone: "plaine", isFirstOfTour: true },
    history: { sameDayVisits: [], seriesProgress: {} },
    date,
  };
}

function copyProposal(result: CodingResult): void {
  const lines = result.lines.map(
    ({ code, coefficient, amountCents }) =>
      `${code}${coefficient === null ? "" : ` ${coefficient.toLocaleString("fr-FR")}`} — ${formatMoney(amountCents)}`,
  );
  void navigator.clipboard.writeText(
    [`Proposition IDEL OS`, ...lines, `Total indicatif : ${formatMoney(result.totalCents)}`].join("\n"),
  );
}

export function CodingDemo() {
  const [actId, setActId] = useState<ActChoice>(actOptions[0]?.id ?? "pansement-non-chirurgical");
  const [home, setHome] = useState(true);
  const [sunday, setSunday] = useState(false);
  const [night, setNight] = useState(false);
  const [child, setChild] = useState(false);
  const [copied, setCopied] = useState(false);
  const result = useMemo(
    () => evaluate(buildContext(actId, { home, sunday, night, child })),
    [actId, child, home, night, sunday],
  );

  function handleCopy(): void {
    copyProposal(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="demo-grid">
      <section className="card settings-card">
        <div className="section-label">1 · Contexte du passage</div>
        <label className="field">
          Soin réalisé
          <select value={actId} onChange={(event) => setActId(event.target.value)}>
            {actOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <div className="toggle-list">
          <Toggle checked={home} label="Passage à domicile · 3 km du cabinet" onChange={setHome} />
          <Toggle checked={sunday} label="Dimanche ou jour férié" onChange={setSunday} />
          <Toggle checked={night} label="Nuit · entre 20 h et 23 h" onChange={setNight} />
          <Toggle checked={child} label="Patient synthétique de moins de 7 ans" onChange={setChild} />
        </div>
        <p className="microcopy">Date de simulation : 12 août 2026 · Métropole · Les données affichées sont fictives.</p>
      </section>

      <section className="card result-card" aria-live="polite">
        <div className="result-topline">
          <div><div className="section-label">2 · Proposition à valider</div><span className="status-pill">À vérifier</span></div>
          <div className="total"><span>Total indicatif</span><strong>{formatMoney(result.totalCents)}</strong></div>
        </div>
        <div className="coding-lines">
          {result.lines.map((line) => (
            <div className="coding-line" key={line.id}>
              <div><strong>{line.code}{line.coefficient === null ? "" : ` ${line.coefficient.toLocaleString("fr-FR")}`}</strong><span>{line.label}</span></div>
              <strong>{formatMoney(line.amountCents)}</strong>
            </div>
          ))}
        </div>
        {result.alerts.map((alert) => <div className={`alert alert-${alert.severity}`} key={alert.code}><strong>{alert.severity === "blocking" ? "À compléter" : "À vérifier"}</strong><span>{alert.message}</span></div>)}
        <div className="trace"><strong>Pourquoi cette proposition ?</strong><p>{result.explanation.summary} {result.appliedRules.length} règle(s) de calcul tracée(s).</p></div>
        <button className="button copy-button" type="button" onClick={handleCopy}>{copied ? "Copié ✓" : "Copier pour mon logiciel"}</button>
      </section>
    </div>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span>{label}</span><input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} /><span aria-hidden="true" className="toggle-control" /></label>;
}
