import Link from "next/link";

function BrandMark() {
  return (
    <span className="home-brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="m5.5 10.2 2.8 2.8 6.2-6.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="home-shell">
      <div className="home-glow home-glow-one" />
      <div className="home-glow home-glow-two" />

      <header className="home-topbar">
        <Link className="home-brand" href="/" aria-label="IDEL OS, accueil">
          <BrandMark />
          <span>IDEL OS</span>
        </Link>

        <nav className="home-nav" aria-label="Navigation principale">
          <a href="#fonctionnement">Fonctionnement</a>
          <a href="#confiance">Confiance</a>
        </nav>

        <div className="home-header-actions">
          <Link className="home-login-link" href="/connexion">Se connecter</Link>
          <Link className="home-small-button" href="/inscription">
            Créer mon espace
          </Link>
        </div>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-copy">
          <div className="home-eyebrow">
            <span className="home-eyebrow-dot" />
            Le copilote des infirmiers libéraux
          </div>

          <h1 id="home-title">
            La bonne cotation,
            <span>sans perdre le fil du soin.</span>
          </h1>

          <p className="home-lead">
            Transformez une ordonnance en proposition NGAP claire, structurée et explicable — en quelques secondes.
          </p>

          <div className="home-actions">
            <Link className="home-primary-button" href="/demo-cotation">
              Tester avec un cas fictif
              <ArrowIcon />
            </Link>
            <a className="home-text-button" href="#fonctionnement">
              Découvrir comment ça marche
            </a>
          </div>

          <div className="home-reassurance" id="confiance">
            <span><CheckIcon /> Sans engagement</span>
            <span><CheckIcon /> Données synthétiques</span>
            <span><CheckIcon /> Décision 100 % humaine</span>
          </div>
        </div>

        <div className="home-product-stage" aria-label="Aperçu d’une proposition de cotation IDEL OS">
          <div className="home-orbit home-orbit-one" />
          <div className="home-orbit home-orbit-two" />

          <div className="home-floating-pill home-floating-pill-top">
            <span className="home-pulse-dot" />
            Calcul local et instantané
          </div>

          <article className="home-product-card">
            <header className="home-product-header">
              <div>
                <span className="home-product-label">Proposition de cotation</span>
                <strong>Pansement complexe</strong>
              </div>
              <span className="home-status"><i /> À vérifier</span>
            </header>

            <div className="home-patient-row">
              <div className="home-avatar">MS</div>
              <div>
                <strong>Marie S.</strong>
                <span>Cas fictif · Passage du matin</span>
              </div>
              <span className="home-date">12 août</span>
            </div>

            <div className="home-coding-box">
              <div className="home-coding-head">
                <span>Cotation proposée</span>
                <span>Montant</span>
              </div>
              <div className="home-coding-row">
                <div>
                  <span className="home-code">AMI 4</span>
                  <span>Soin de plaie complexe</span>
                </div>
                <strong>12,60 €</strong>
              </div>
              <div className="home-coding-row">
                <div>
                  <span className="home-code home-code-soft">IFD</span>
                  <span>Indemnité forfaitaire</span>
                </div>
                <strong>2,75 €</strong>
              </div>
            </div>

            <div className="home-result-row">
              <div>
                <span>Total estimé</span>
                <small>Hors majorations éventuelles</small>
              </div>
              <strong>15,35 €</strong>
            </div>

            <div className="home-explanation">
              <span className="home-spark">✦</span>
              <div>
                <strong>Pourquoi cette proposition ?</strong>
                <span>Chaque règle appliquée est détaillée et traçable.</span>
              </div>
              <ArrowIcon />
            </div>
          </article>

          <div className="home-floating-pill home-floating-pill-bottom">
            <span className="home-shield"><CheckIcon /></span>
            <span><strong>Vous gardez la main</strong>Validation par le professionnel</span>
          </div>
        </div>
      </section>

      <section className="home-proof" id="fonctionnement" aria-label="Principes de fonctionnement">
        <div className="home-proof-intro">
          <span>Conçu pour votre pratique</span>
          <strong>Moins d’administratif.<br />Plus de sérénité.</strong>
        </div>
        <div className="home-proof-item">
          <span className="home-proof-number">01</span>
          <div>
            <strong>Clair</strong>
            <p>Une proposition lisible, sans jargon inutile.</p>
          </div>
        </div>
        <div className="home-proof-item">
          <span className="home-proof-number">02</span>
          <div>
            <strong>Traçable</strong>
            <p>Chaque montant est relié à une règle datée.</p>
          </div>
        </div>
        <div className="home-proof-item">
          <span className="home-proof-number">03</span>
          <div>
            <strong>Responsable</strong>
            <p>L’outil propose. Le professionnel décide.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
