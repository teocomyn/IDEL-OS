# IDEL OS

Socle S0–S1 du copilote administratif des infirmiers libéraux.

## Prérequis

- Node.js 22
- pnpm 10.33
- Docker Desktop

## Démarrage local

Copiez `.env.example` vers `.env`, remplacez les secrets locaux, puis lancez :

```bash
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm dev
```

Les environnements de développement et de test n’acceptent que des données synthétiques.

## Vérifications

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @idel-os/sync test:coverage
```

Le test RLS utilise Testcontainers et requiert un daemon Docker actif. Sur macOS, le binaire
`docker-credential-desktop` doit être présent dans le `PATH`.

## Périmètre actuel

- monorepo pnpm/Turborepo strict ;
- schéma PostgreSQL/Drizzle, migrations, RLS et audit append-only ;
- chiffrement AES-256-GCM par organisation ;
- Better Auth, email/mot de passe, HIBP et TOTP ;
- patients, exports RGPD JSON/PDF et socle offline ;
- moteur NGAP déterministe avec règles datées et scénarios de test ;
- transmissions vocales avec transcription locale, correction humaine, constantes typées, relève et accusés ;
- génération déterministe des passages depuis un plan de soins, avec regroupement des actes compatibles ;
- optimisation OSRM/VROOM auto-hébergée, multi-IDEL et contrôlée par un diff obligatoire avant application ;
- cycle de vie sécurisé des passages : démarrage, checklist des actes et clôture auditée ;
- démonstrations Next.js responsive pour Aujourd’hui, l’ordonnance, la cotation et les transmissions.

L’OCR réel et les appels LLM restent désactivés : ils ne seront raccordés qu’à une infrastructure
HDS avec redaction des données identifiantes et jeux d’évaluation dédiés.
