import Link from "next/link";

export default function HomePage() {
  return <main className="shell">
    <header className="topbar"><span className="brand">IDEL OS</span><span className="badge">Données synthétiques uniquement</span></header>
    <section className="hero">
      <div><h1>La cotation, préparée. La décision, toujours vôtre.</h1><p>IDEL OS transforme une ordonnance en proposition structurée et explicable. Aucun diagnostic, aucune télétransmission.</p><div className="actions"><Link className="button" href="/inscription">Créer mon espace</Link><Link className="button secondary" href="/connexion">Me connecter</Link></div></div>
      <aside className="card"><div className="notice">Proposition générée automatiquement. La responsabilité de la cotation et du soin reste celle du professionnel.</div><h2 style={{marginTop:24}}>Socle sécurisé prêt</h2><p>Double authentification, isolation cabinet, chiffrement applicatif et fonctionnement hors ligne préparé dès le départ.</p></aside>
    </section>
  </main>;
}
