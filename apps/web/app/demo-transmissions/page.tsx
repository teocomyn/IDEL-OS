import Link from "next/link";

import { HandoverDemo } from "./handover-demo";

export default function TransmissionsDemoPage() {
  return (
    <main className="handover-shell">
      <header className="handover-topbar">
        <Link className="handover-brand" href="/">
          <span className="handover-logo" aria-hidden="true">IO</span>
          <span>IDEL OS</span>
        </Link>
        <div className="handover-demo-badge"><i /> Démonstration · données fictives</div>
        <Link className="handover-exit" href="/">Quitter la démo</Link>
      </header>
      <HandoverDemo />
    </main>
  );
}
