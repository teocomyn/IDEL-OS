import Link from "next/link";

import { TodayDemo } from "./today-demo";

export default function TodayDemoPage() {
  return (
    <main className="today-shell">
      <header className="today-topbar">
        <Link className="today-brand" href="/"><span className="today-logo">IO</span><span>IDEL OS</span></Link>
        <div className="today-date">Mercredi 12 août 2026</div>
        <div className="today-account"><span className="today-sync"><i /> Synchronisé</span><span className="today-user">EM</span></div>
      </header>
      <TodayDemo />
    </main>
  );
}
