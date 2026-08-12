export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="shell"><section className="card"><span className="badge">Dossier {id.slice(0,8)}</span><h2 style={{marginTop:20}}>Dossier patient</h2><p>Chargez ce dossier via l’API sécurisée. Aucune identité n’est rendue côté serveur sans session cabinet et TOTP validés.</p><div className="actions"><button className="button">Exporter les données</button><button className="button secondary">Rectifier</button></div></section></main>;
}
