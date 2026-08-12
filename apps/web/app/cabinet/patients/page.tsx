import Link from "next/link";

export default function PatientsPage() {
  return <main className="shell"><header className="topbar"><span className="brand">Patients</span><Link className="button" href="/cabinet/patients/nouveau">Nouveau patient</Link></header><section className="card"><h2>Aucun patient</h2><p>Ajoutez votre premier dossier. Les données de démonstration doivent rester strictement synthétiques.</p></section></main>;
}
