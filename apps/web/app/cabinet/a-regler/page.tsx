import { connection } from "next/server";

import { trpcQuery } from "../../../lib/trpc-server";
import type { CockpitResponse, MessageDraftView } from "../../../lib/cabinet-types";
import { CockpitBoard } from "./cockpit-board";

export default async function CockpitPage() {
  await connection();
  const asOf = parisDate(new Date());
  let cockpit: CockpitResponse | null = null;
  let drafts: MessageDraftView[] = [];
  let error: string | null = null;
  try {
    [cockpit, drafts] = await Promise.all([
      trpcQuery<CockpitResponse>("cockpit.list", { asOf, horizonDays: 30, categories: [] }),
      trpcQuery<MessageDraftView[]>("cockpit.messageDrafts"),
    ]);
  } catch (reason) {
    error = reason instanceof Error ? reason.message : "Connexion au cabinet impossible.";
  }
  return <main className="cabinet-page">
    <header className="cabinet-page-head">
      <div><span className="cabinet-eyebrow">Cockpit administratif</span><h1>À régler</h1><p>Tout ce qui mérite une action, au même endroit. Rien n’est envoyé sans validation humaine.</p></div>
      <div className="cabinet-head-status"><span><i />Données du cabinet</span><small>Mis à jour à l’ouverture</small></div>
    </header>
    {cockpit === null
      ? <ConnectionState message={error ?? "Aucune donnée disponible."} />
      : <CockpitBoard cockpit={cockpit} drafts={drafts} />}
  </main>;
}

function ConnectionState({ message }: { message: string }) {
  return <section className="cabinet-connection-state"><span className="cabinet-empty-icon">↻</span><h2>Connectez votre espace sécurisé</h2><p>{message}</p><a href="/connexion">Se connecter avec le double facteur</a></section>;
}

function parisDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Paris" }).format(date);
}
