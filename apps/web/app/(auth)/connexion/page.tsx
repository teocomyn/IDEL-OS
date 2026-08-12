import Link from "next/link";

export default function SignInPage() {
  return <main className="shell"><div className="card" style={{maxWidth:520,margin:"64px auto"}}><span className="brand">IDEL OS</span><h2 style={{marginTop:32}}>Connexion</h2><p>Votre second facteur sera demandé après le mot de passe.</p><form><label className="field">Adresse e-mail<input type="email" autoComplete="email" required /></label><label className="field">Mot de passe<input type="password" autoComplete="current-password" minLength={12} required /></label><button className="button" type="submit" style={{width:"100%"}}>Continuer</button></form><p><Link href="/inscription">Créer un compte professionnel</Link></p></div></main>;
}
