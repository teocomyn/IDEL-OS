import Link from "next/link";

export default function HomePage() {
  return <main className="shell">
    <header className="topbar"><span className="brand">IDEL OS</span><span className="badge">Données synthétiques uniquement</span></header>
    <section className="hero">
      <div><h1>La cotation, préparée. La décision, toujours vôtre.</h1><p>IDEL OS transforme une ordonnance en proposition structurée et explicable. Aucun diagnostic, aucune télétransmission.</p><div className="actions"><Link className="button" href="/demo-cotation">Tester la cotation</Link><Link className="button secondary" href="/inscription">Créer mon espace</Link></div></div>
      <aside className="card"><div className="notice">Proposition générée automatiquement. La responsabilité de la cotation et du soin reste celle du professionnel.</div><h2 style={{marginTop:24}}>Le moteur NGAP est testable</h2><p>Essayez un scénario 100 % synthétique. Chaque montant est daté, chaque règle est traçable et aucune donnée ne quitte votre navigateur.</p><Link className="text-link" href="/demo-cotation">Ouvrir la démonstration →</Link></aside>
    </section>
  </main>;
}
