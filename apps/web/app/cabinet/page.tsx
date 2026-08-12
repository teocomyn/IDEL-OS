import Link from "next/link";

export default function CabinetPage() {
  return <main className="shell"><header className="topbar"><span className="brand">IDEL OS</span><span className="badge">Synchronisé à l’instant</span></header><section className="card"><h2>Aujourd’hui</h2><p>Les indicateurs de temps et de cotation apparaîtront seulement lorsqu’ils seront calculables.</p><div className="notice">Aucune donnée suffisante pour calculer un gain ce mois-ci.</div><div className="actions"><Link className="button" href="/cabinet/patients/nouveau">Ajouter un patient</Link><Link className="button secondary" href="/cabinet/patients">Voir les patients</Link></div></section></main>;
}
