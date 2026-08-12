import Link from "next/link";

import { PrescriptionDemo } from "./prescription-demo";

export default function PrescriptionDemoPage() {
  return (
    <main className="rx-shell">
      <header className="rx-topbar">
        <Link className="rx-brand" href="/">
          <span className="rx-logo" aria-hidden="true">IO</span>
          <span>IDEL OS</span>
        </Link>
        <div className="rx-demo-badge"><i /> Démonstration · ordonnance fictive</div>
        <Link className="rx-exit" href="/">Quitter la démo</Link>
      </header>
      <PrescriptionDemo />
    </main>
  );
}
