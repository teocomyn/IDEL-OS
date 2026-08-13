import { connection } from "next/server";

import type { CabinetDashboard } from "../../../lib/cabinet-types";
import { trpcQuery } from "../../../lib/trpc-server";
import { CabinetWorkspace } from "./workspace";

export default async function CabinetTeamPage() {
  await connection();
  const from = parisDate(new Date());
  const toDate = new Date();
  toDate.setDate(toDate.getDate() + 6);
  const to = parisDate(toDate);
  let dashboard: CabinetDashboard | null = null;
  let error: string | null = null;
  try {
    dashboard = await trpcQuery<CabinetDashboard>("cabinet.dashboard", { from, to });
  } catch (reason) {
    error = reason instanceof Error ? reason.message : "Connexion au cabinet impossible.";
  }
  return <main className="cabinet-page">
    <header className="cabinet-page-head">
      <div><span className="cabinet-eyebrow">Organisation du cabinet</span><h1>Cabinet</h1><p>Planning, équipe, accès patients, relève et rétrocessions dans un espace partagé et traçable.</p></div>
      <div className="cabinet-head-status"><span><i />Semaine en cours</span><small>{shortDate(from)} — {shortDate(to)}</small></div>
    </header>
    {dashboard === null
      ? <section className="cabinet-connection-state"><span className="cabinet-empty-icon">↻</span><h2>Connectez votre espace sécurisé</h2><p>{error}</p><a href="/connexion">Se connecter avec le double facteur</a></section>
      : <CabinetWorkspace dashboard={dashboard} />}
  </main>;
}

function parisDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Paris" }).format(date);
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00.000Z`));
}
