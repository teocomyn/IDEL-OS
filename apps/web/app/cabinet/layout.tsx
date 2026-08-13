import Link from "next/link";
import type { ReactNode } from "react";

export default function CabinetLayout({ children }: { children: ReactNode }) {
  return <div className="cabinet-app">
    <aside className="cabinet-sidebar">
      <Link className="cabinet-logo" href="/cabinet/a-regler" aria-label="IDEL OS — Accueil cabinet">
        <span className="cabinet-logo-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>IDEL OS<small>Cabinet</small></span>
      </Link>
      <nav className="cabinet-nav" aria-label="Navigation du cabinet">
        <Link href="/demo-aujourdhui"><NavIcon name="today" />Aujourd’hui</Link>
        <Link href="/cabinet/a-regler"><NavIcon name="check" />À régler</Link>
        <Link href="/cabinet/equipe"><NavIcon name="team" />Cabinet</Link>
        <Link href="/cabinet/patients"><NavIcon name="patients" />Patients</Link>
        <Link href="/demo-transmissions"><NavIcon name="voice" />Transmissions</Link>
        <Link href="/demo-cotation"><NavIcon name="coding" />Cotation</Link>
      </nav>
      <div className="cabinet-sidebar-foot">
        <span className="cabinet-secure"><i />Espace chiffré</span>
        <Link href="/">Quitter le cabinet</Link>
      </div>
    </aside>
    <div className="cabinet-main">
      <header className="cabinet-mobilebar">
        <Link className="cabinet-logo" href="/cabinet/a-regler"><span className="cabinet-logo-mark"><i /><i /><i /></span><span>IDEL OS</span></Link>
        <span className="cabinet-secure"><i />Synchronisé</span>
      </header>
      {children}
    </div>
  </div>;
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    today: <><path d="M5 3v3M15 3v3M3 8h14"/><rect x="3" y="5" width="14" height="12" rx="2"/></>,
    check: <><path d="m7 10 2 2 4-5"/><rect x="3" y="3" width="14" height="14" rx="4"/></>,
    team: <><circle cx="8" cy="7" r="3"/><circle cx="15" cy="8" r="2"/><path d="M3 17c0-3 2-5 5-5s5 2 5 5M13 13c2.5 0 4 1.5 4 4"/></>,
    patients: <><path d="M10 4v12M4 10h12"/><circle cx="10" cy="10" r="8"/></>,
    voice: <><rect x="7" y="3" width="6" height="10" rx="3"/><path d="M4 10a6 6 0 0 0 12 0M10 16v3M7 19h6"/></>,
    coding: <><path d="M7 6 3 10l4 4M13 6l4 4-4 4M11 4 9 16"/></>,
  };
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
