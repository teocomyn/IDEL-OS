import Link from "next/link";

import { CodingDemo } from "./coding-demo";

export default function CodingDemoPage() {
  return (
    <main className="shell demo-shell">
      <header className="topbar compact-topbar">
        <Link className="brand" href="/">IDEL OS</Link>
        <span className="badge">Démonstration synthétique</span>
      </header>
      <div className="demo-heading">
        <div>
          <span className="eyebrow">Moteur NGAP</span>
          <h1>Testez une proposition de cotation.</h1>
          <p>Choisissez un soin et le contexte du passage. Le calcul se fait localement, sans LLM.</p>
        </div>
        <Link className="back-link" href="/">← Retour à l’accueil</Link>
      </div>
      <div className="notice legal-notice">Proposition générée automatiquement. La responsabilité de la cotation et du soin reste celle du professionnel. Règles de démonstration en attente de validation métier.</div>
      <CodingDemo />
    </main>
  );
}
