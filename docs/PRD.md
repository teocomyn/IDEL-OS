# MASTER PROMPT : IDEL OS
### Le copilote IA des infirmiers libéraux
> Prompt à coller tel quel dans Claude Code, Cursor Composer (mode Agent) ou Codex.
> Version 1.0 : août 2026. Auteur du brief : Teo Comyn (KOMYN / EXPERAISE).

---

## COMMENT UTILISER CE DOCUMENT

1. Crée un dossier vide `idel-os`, ouvre-le dans ton IDE.
2. Colle **l'intégralité** de ce document comme premier message à l'agent.
3. L'agent doit d'abord répondre par un **plan** (section 19), pas par du code.
4. Enregistre ensuite ce document sous `docs/PRD.md` dans le repo : c'est la source de vérité.
5. Copie la section 18 dans `CLAUDE.md` (ou `.cursorrules`) à la racine.

---

# 0. INSTRUCTIONS À L'AGENT (à lire en premier)

Tu es un ingénieur produit senior full-stack, spécialisé SaaS santé français, RGPD et systèmes à règles métier. Tu construis **IDEL OS**.

### Règles de travail non négociables

1. **Plan avant code.** Avant toute écriture de fichier, produis un plan d'implémentation numéroté et attends validation. Après validation, exécute par lots cohérents (un module = un lot).
2. **Pose des questions** dès qu'une décision produit est ambiguë, au lieu d'inventer. Regroupe tes questions par 3 à 5 maximum.
3. **Jamais de code non testé.** Toute logique métier (moteur NGAP, tournée, parsing) est couverte par des tests unitaires écrits AVANT l'implémentation. Objectif : 90 % de couverture sur `packages/ngap-engine` et `packages/routing`.
4. **Zéro donnée de santé réelle** en dev. Tout est fixtures/seed synthétiques. Aucune donnée de test ne doit ressembler à une vraie personne.
5. **Le déterminisme prime sur le LLM.** Le LLM propose, le moteur de règles valide, l'humain décide. Une cotation NGAP ne sort JAMAIS d'une hallucination LLM non vérifiée par le moteur de règles.
6. **Type-safety de bout en bout.** TypeScript strict, `noUncheckedIndexedAccess`, aucun `any` sans commentaire justificatif. Toute sortie LLM passe par un schéma Zod.
7. **Mobile-first, toujours.** L'utilisatrice est dans une voiture ou sur un palier, avec une main, des gants, en 4G instable. Chaque écran est conçu pour ça.
8. **Offline-first.** L'app doit fonctionner sans réseau puis se synchroniser. C'est une contrainte d'architecture, pas une option de fin de projet.
9. **Commits atomiques**, messages en conventional commits, en anglais. Le code et les commentaires en anglais, les libellés produit en français.
10. **Ne jamais** implémenter la télétransmission SESAM-Vitale, la FSE, ou l'envoi de flux à l'Assurance Maladie. Voir section 3.

### Format de tes réponses

- Court, technique, sans flatterie.
- Quand tu termines un lot : liste des fichiers créés/modifiés, comment lancer les tests, ce qui reste.
- Quand tu es bloqué : dis-le immédiatement, ne contourne pas silencieusement.

---

# 1. LE PRODUIT

## 1.1 Pitch

**IDEL OS est le copilote IA des infirmiers libéraux.**
Il transforme une ordonnance photographiée en tournée optimisée, cotation NGAP proposée et justifiée, transmissions structurées et administratif prêt à traiter.

## 1.2 Positionnement stratégique (critique, à respecter)

IDEL OS **ne remplace pas** Albus, Agathe YOU, VEGA, Résamed ou tout autre logiciel métier agréé. Il ne fait pas de télétransmission.
IDEL OS est la **couche d'intelligence au-dessus** de ces logiciels : il prépare, propose, contrôle, explique, exporte. L'IDEL saisit ensuite la facture dans son logiciel agréé (à terme via export/API/copier-coller assisté).

Corollaire produit : chaque écran doit répondre à la question « qu'est-ce que je copie dans mon logiciel de facturation ? » avec un bouton de copie ou d'export.

## 1.3 Utilisatrice cible

- Infirmière libérale, 30 à 55 ans, exerçant seule ou en cabinet de 2 à 6.
- 25 à 45 patients par jour, 2 tournées (matin 6h30-12h, soir 16h30-20h).
- Équipement : iPhone ou Android milieu de gamme, parfois un iPad, un PC au cabinet.
- Douleurs (par ordre de fréquence citée) : cotation incertaine, temps administratif le soir, rejets CPAM, tournée mal optimisée, transmissions bâclées, ordonnances qui expirent sans prévenir.
- Sensibilité au prix : forte. Payer 29 à 59 €/mois n'est acceptable que si la valeur est démontrable en euros ou en minutes.

## 1.4 La promesse chiffrée à tenir

Sur l'écran d'accueil, en permanence :
> « IDEL OS vous a fait gagner **X minutes** et détecté **Y €** de cotation potentiellement oubliée ce mois-ci. »

Ces deux compteurs doivent être calculés à partir de données réelles d'usage, jamais inventés. Si on ne sait pas mesurer, on n'affiche pas.

---

# 2. PÉRIMÈTRE

## 2.1 MVP v0.1 : le wedge (à livrer en premier, seul)

**« Photo d'ordonnance → plan de soins + cotation NGAP proposée et expliquée. »**

```
📸 Photo ordonnance
   ↓
🔍 OCR + Vision (extraction structurée)
   ↓
🧠 Compréhension des soins prescrits
   ↓
📋 Proposition de cotation NGAP + justification article par article
   ↓
⚠️ Alertes : incohérences, informations manquantes, risque de rejet, sous-cotation
   ↓
📅 Génération des passages (récurrence)
   ↓
🗺️ Ajout à la tournée
```

Rien d'autre. Pas de facturation, pas de télétransmission, pas de marketplace, pas de portail patient, pas de comptabilité.

## 2.2 Ordre de construction des modules

| # | Module | Version | Priorité |
|---|--------|---------|----------|
| M0 | Socle : auth, RLS, chiffrement, audit log, offline sync | v0.1 | Bloquant |
| M1 | Patients + ordonnances (CRUD, photo, OCR) | v0.1 | Bloquant |
| M2 | Moteur NGAP (règles + copilote LLM) | v0.1 | Bloquant |
| M3 | Plan de soins et passages (récurrence) | v0.1 | Bloquant |
| M4 | Tournée : liste ordonnée + optimisation | v0.2 | Haute |
| M5 | Transmissions vocales structurées | v0.2 | Haute |
| M6 | Assistant administratif (« quoi régler aujourd'hui ») | v0.3 | Moyenne |
| M7 | Dashboard « argent oublié » et analytics | v0.3 | Moyenne |
| M8 | Multi-IDEL / cabinet, planning partagé | v0.4 | Moyenne |
| M9 | Remplacements et rétrocessions | v0.5 | Basse |
| M10 | Portail patient minimal | v0.6 | Basse |
| M11 | Agent conversationnel global (langage naturel sur tous les modules) | v0.4 | Haute (différenciant) |

**Construis M0 à M3 complètement avant de toucher à M4.**

## 2.3 Hors périmètre définitif (v1)

- Télétransmission SESAM-Vitale, FSE, DRE, lecture de carte Vitale.
- Comptabilité et liasse fiscale (BNC 2035).
- Édition de feuilles de soins papier opposables.
- Prescription ou modification d'une prescription médicale.
- Diagnostic médical ou recommandation thérapeutique.

---

# 3. CONTRAINTES LÉGALES ET DE SÉCURITÉ (non négociables)

L'agent doit implémenter ces contraintes **dès le premier commit**, pas les repousser.

## 3.1 Hébergement de données de santé (HDS)

Toute donnée de santé à caractère personnel doit être hébergée chez un hébergeur **certifié HDS**. Conséquences directes sur l'architecture :

- **Base de données, stockage de fichiers (photos d'ordonnance, audios), logs applicatifs contenant de la donnée patient : hébergeur certifié HDS uniquement, en France ou UE.**
- Candidats à retenir : **Scaleway** (offre HDS), **OVHcloud** (HDS), **Clever Cloud** (HDS), **Outscale**. Vérifie la certification en cours de validité avant de choisir.
- Supabase Cloud n'est pas certifié HDS : si l'agent veut Supabase, ce doit être **Supabase self-hosted sur infra HDS**, ou bien Postgres managé HDS + une couche maison. Documente le choix dans `docs/ADR-001-hosting.md`.
- Vercel / Netlify / Railway / Fly.io : acceptables **uniquement** pour servir des assets statiques et du front sans donnée de santé. Aucun traitement de donnée de santé.

## 3.2 Sous-traitance IA

Un appel à un LLM avec de la donnée de santé fait de l'éditeur du LLM un sous-traitant. Donc :

- **Pseudonymisation obligatoire avant tout appel LLM.** Le nom, prénom, date de naissance, adresse, NIR du patient ne sortent JAMAIS vers un LLM. On envoie des identifiants opaques (`PATIENT_A`) et on ré-hydrate côté serveur.
- Implémente un module `packages/phi-redaction` : redaction en entrée, ré-hydratation en sortie, tests exhaustifs. Aucun appel LLM ne peut bypasser ce module (impose-le par le type system : la fonction d'appel LLM n'accepte qu'un type `RedactedPayload`).
- Privilégier des fournisseurs avec DPA, engagement de non-entraînement, hébergement UE. Prévoir une abstraction `packages/llm` avec adaptateurs interchangeables (Anthropic, Mistral AI qui est français, OpenAI, modèle auto-hébergé).
- Sur l'OCR : évaluer une solution auto-hébergée (docTR, PaddleOCR, Tesseract + modèle vision local) pour éviter de sortir l'image d'ordonnance. Architecture à prévoir en pipeline remplaçable.

## 3.3 RGPD

- Base légale, registre des traitements, DPO, politique de confidentialité, mentions dans l'app : à générer dans `docs/rgpd/`.
- Droits : export des données (JSON + PDF), suppression, rectification. Implémenter les endpoints dès M0.
- Durées de conservation paramétrables, purge automatique programmée.
- Consentement patient : l'IDEL est responsable de traitement pour ses patients, IDEL OS est sous-traitant. Le contrat de sous-traitance (art. 28) doit exister.
- **Chiffrement au repos** de tous les champs sensibles (voir 6.4) et en transit (TLS 1.3 minimum).

## 3.4 Statut réglementaire du produit

Une IA qui **propose une cotation administrative** n'est pas un dispositif médical. Une IA qui **oriente une décision de soin** en est un. Ligne rouge à tenir dans le code et dans les prompts :

- Le système ne dit jamais « faites ceci au patient ». Il dit « voici comment cette prescription se cote ».
- Toute sortie IA est estampillée **proposition** et requiert une validation humaine explicite (un tap sur « Valider »), tracée dans l'audit log avec l'identifiant du professionnel.
- Bandeau permanent dans les écrans IA : « Proposition générée automatiquement. La responsabilité de la cotation et du soin reste celle du professionnel. »
- Rédige `docs/ADR-002-statut-reglementaire.md` qui argumente pourquoi le produit reste hors dispositif médical, et qui liste les fonctionnalités interdites qui le feraient basculer.

## 3.5 Authentification professionnelle

- Prévoir dès l'architecture l'intégration **Pro Santé Connect** (OpenID Connect, e-CPS/CPS, habilitation via datapass.api.gouv.fr, environnement bac à sable puis production). Le dossier d'habilitation exige la preuve d'hébergement HDS et les coordonnées du DPO.
- MVP : email + mot de passe fort + TOTP obligatoire, avec un `AuthProvider` abstrait permettant d'ajouter PSC sans refonte.
- Capturer et vérifier le **numéro RPPS** ou ADELI à l'inscription (champ obligatoire, format validé).

## 3.6 Audit trail

Table `audit_log` append-only, jamais modifiable, jamais supprimable par l'application :
`id, actor_user_id, actor_role, action, resource_type, resource_id, before_hash, after_hash, ai_proposal_id (nullable), ip, user_agent, created_at`.

Toute proposition IA acceptée, modifiée ou rejetée est loggée avec la proposition originale ET la décision humaine. C'est votre meilleure défense en cas de litige, et c'est aussi votre dataset d'amélioration.

---

# 4. STACK TECHNIQUE

Stack imposée sauf argumentation écrite dans un ADR.

## 4.1 Monorepo

```
idel-os/
├── apps/
│   ├── mobile/          # Expo (React Native) - l'app principale
│   ├── web/             # Next.js 15 App Router - cabinet, admin, marketing
│   └── api/             # Fastify + tRPC - le backend
├── packages/
│   ├── db/              # Drizzle ORM, schéma, migrations, RLS
│   ├── ngap-engine/     # ⭐ le cœur : moteur de règles déterministe
│   ├── llm/             # abstraction fournisseurs + prompts versionnés
│   ├── phi-redaction/   # pseudonymisation obligatoire avant LLM
│   ├── ocr/             # pipeline d'extraction d'ordonnance
│   ├── routing/         # optimisation de tournée (VRPTW)
│   ├── sync/            # moteur de synchronisation offline
│   ├── shared/          # types, schémas Zod, constantes métier
│   └── ui/              # design system partagé (Tamagui ou RN + Tailwind web)
├── docs/
│   ├── PRD.md           # ce document
│   ├── ADR-*.md
│   ├── rgpd/
│   └── ngap/            # règles NGAP sourcées, une par fichier
└── infra/               # IaC, docker-compose local, CI/CD
```

Outils : pnpm workspaces + Turborepo. TypeScript 5.x strict partout.

## 4.2 Choix par couche

| Couche | Choix | Justification |
|---|---|---|
| Mobile | **Expo / React Native**, expo-router | Une base de code iOS + Android, OTA updates, écosystème mature |
| Web | **Next.js 15**, App Router, RSC | SEO marketing + back-office cabinet |
| API | **Fastify + tRPC** | Type-safety bout en bout sans codegen, perf |
| DB | **PostgreSQL 16** + **Drizzle ORM** | RLS natif, extensions (pgvector, PostGIS), migrations typées |
| Auth | **Lucia** ou **Better Auth** (self-hostable) | Pas de dépendance à un SaaS non HDS |
| Offline | **WatermelonDB** ou **PowerSync** + queue d'actions | Sync bidirectionnelle robuste |
| Stockage fichiers | S3-compatible sur infra HDS (Scaleway Object Storage) | Chiffrement côté serveur + URLs signées courtes |
| Jobs | **BullMQ** + Redis | OCR, transcriptions, optimisations, rappels |
| Géo | **PostGIS** + OSRM auto-hébergé ou Mapbox Matrix API | Matrices de distance réalistes |
| Cartes | MapLibre GL + tuiles OSM ou IGN | Éviter les coûts et les CGU Google |
| Observabilité | OpenTelemetry + Grafana/Loki auto-hébergés | Pas de logs santé chez un tiers non HDS |
| Erreurs | Sentry **self-hosted**, avec scrubbing agressif | Idem |
| Paiement | Stripe (aucune donnée de santé ne transite) | Standard |
| Tests | Vitest (unit), Playwright (e2e web), Maestro (e2e mobile) | |
| CI | GitHub Actions : lint, typecheck, tests, build, migrations dry-run | |

## 4.3 Contraintes de performance

- Ouverture de l'app à liste de tournée affichée : **< 1,5 s** en cache froid, données locales.
- Photo d'ordonnance à proposition affichée : **< 12 s** en 4G, avec un état de progression explicite et une possibilité de continuer à travailler pendant le traitement.
- Aucun écran ne doit être bloquant en cas d'absence de réseau.

---

# 5. ARCHITECTURE FONCTIONNELLE

## 5.1 Flux central

```
        ┌──────────────┐
        │  Ordonnance  │  photo / PDF / saisie manuelle
        └──────┬───────┘
               │ OCR + Vision + LLM (pseudonymisé)
               ▼
        ┌──────────────┐
        │  Prescription│  entité structurée : prescripteur, date, durée,
        │   structurée │  actes prescrits, fréquence, contraintes
        └──────┬───────┘
               │ NGAP Engine (déterministe) + LLM Copilot (explication)
               ▼
        ┌──────────────┐
        │  CarePlan    │  plan de soins : quoi, quand, combien de temps
        │  + Coding    │  + cotation proposée + alertes
        └──────┬───────┘
               │ générateur de récurrence
               ▼
        ┌──────────────┐
        │   Visits     │  passages datés, assignables, géolocalisés
        └──────┬───────┘
               │ optimiseur (VRPTW)
               ▼
        ┌──────────────┐
        │    Tour      │  tournée du jour, ordonnée, ETA par patient
        └──────┬───────┘
               │ exécution terrain
               ▼
        ┌──────────────┐
        │ Transmission │  vocal → texte structuré → validation
        │ + Acte réalisé│ → cotation confirmée → export vers logiciel agréé
        └──────────────┘
```

## 5.2 Principe architectural clé : le triptyque

Pour **toute** fonctionnalité IA, trois couches distinctes et testables séparément :

1. **Extraction** (LLM / OCR) : transformer du non-structuré en JSON validé par Zod. Peut halluciner, donc sortie toujours vérifiée.
2. **Décision** (code déterministe) : appliquer les règles métier. Ne peut pas halluciner. Testable exhaustivement. C'est la source d'autorité.
3. **Explication** (LLM) : rendre la décision lisible en français. Ne peut pas modifier la décision, seulement la reformuler. Reçoit la décision en entrée et n'a pas le droit de produire de nouveaux codes.

Interdiction absolue : qu'un LLM produise directement une cotation finale sans passage par la couche 2.

---

# 6. MODÈLE DE DONNÉES

Écris le schéma en Drizzle dans `packages/db/src/schema/`. Voici le modèle attendu (adapte les noms, pas la structure).

## 6.1 Entités socle

```
organizations       id, name, type(solo|cabinet), siret, address, settings_json, created_at
users               id, org_id, email, password_hash, totp_secret, role(owner|idel|remplacant|secretaire),
                    first_name, last_name, rpps, adeli, phone, is_active, last_seen_at
memberships         id, org_id, user_id, role, starts_at, ends_at   -- gère les remplaçants
audit_log           append-only, cf. 3.6
consents            id, org_id, patient_id, type, granted_at, revoked_at, evidence_url
```

## 6.2 Domaine patient

```
patients            id, org_id, first_name_enc, last_name_enc, birth_date_enc, nir_enc,
                    phone_enc, email_enc, notes_enc,
                    address_line_enc, postal_code, city, geo point(PostGIS),
                    access_notes_enc,           -- "code portail 1234B, 3e étage sans ascenseur"
                    mobility(autonomous|assisted|bedridden),
                    is_ald boolean, ald_details_enc,
                    is_diabetic boolean,        -- impacte la MCI et certaines cotations
                    preferred_time_windows jsonb,
                    exemption_type,             -- exonération ticket modérateur
                    mutuelle_json, is_active, created_at
patient_contacts    id, patient_id, kind(family|doctor|pharmacy|lab|other), name, phone, email, notes
prescribers         id, org_id, name, rpps, speciality, phone, email, address, is_favorite
pharmacies          id, org_id, name, address, phone, email
```

## 6.3 Domaine prescription et soins

```
prescriptions       id, org_id, patient_id, prescriber_id,
                    source(photo|pdf|manual|import), original_file_url,
                    prescribed_at date, valid_from date, valid_until date,
                    is_renewal boolean, renews_prescription_id,
                    raw_ocr_text_enc, extraction_json, extraction_confidence numeric,
                    status(draft|validated|expired|archived),
                    validated_by_user_id, validated_at

prescription_items  id, prescription_id, raw_text, act_type, description,
                    frequency_json,       -- {times_per_day:2, days:[mon..sun], every_n_days:1}
                    duration_days, start_date, end_date,
                    constraints_json,     -- horaires imposés, à jeun, avant repas
                    extraction_confidence, needs_review boolean

care_plans          id, org_id, patient_id, prescription_id, name,
                    status(active|paused|completed|cancelled), starts_at, ends_at

care_plan_items     id, care_plan_id, prescription_item_id, act_catalog_id,
                    estimated_duration_min, requires_two_nurses boolean, notes

visits              id, org_id, patient_id, care_plan_id,
                    scheduled_at timestamptz, time_window_start, time_window_end,
                    estimated_duration_min, assigned_user_id,
                    status(planned|in_progress|done|missed|cancelled|refused),
                    started_at, ended_at, geo_checkin point, geo_checkout point,
                    tour_id, position_in_tour int

visit_acts          id, visit_id, care_plan_item_id, act_catalog_id,
                    performed boolean, quantity, notes_enc
```

## 6.4 Domaine NGAP et cotation

**C'est le cœur du produit. Soigne-le.**

```
act_catalog         id, key_letter(AMI|AMX|AIS|BSI|DI|AMC...), coefficient numeric,
                    label, description, ngap_article_ref,
                    category, requires_prescription boolean,
                    is_active boolean, valid_from date, valid_until date,
                    tariff_cents int,           -- historisé, jamais écrasé
                    metadata_json

ngap_rules          id, code, version, type(cumul|majoration|deplacement|forfait|limitation|serie),
                    title, description, ngap_article_ref, source_url, source_date,
                    condition_json,    -- DSL déclaratif, cf. 8.3
                    effect_json,
                    severity(blocking|warning|info|opportunity),
                    is_active, valid_from, valid_until

codings             id, org_id, visit_id, care_plan_id,
                    proposed_by(ai|rules|user), status(proposed|accepted|edited|rejected|exported),
                    total_cents int, explanation_md text,
                    ai_proposal_id, validated_by_user_id, validated_at,
                    exported_at, export_target

coding_lines        id, coding_id, act_catalog_id, key_letter, coefficient,
                    quantity, applied_rate numeric,  -- 100%, 50% pour 2e acte, 0% pour 3e
                    amount_cents, line_type(act|majoration|deplacement|ik|forfait),
                    rule_ids uuid[], justification text

coding_alerts       id, coding_id, rule_id, severity, message,
                    potential_gain_cents int,   -- pour les alertes de sous-cotation
                    acknowledged_by, acknowledged_at

ai_proposals        id, org_id, kind(ocr|coding|transmission|admin|chat),
                    model, prompt_version, input_redacted_json, output_json,
                    latency_ms, tokens_in, tokens_out, cost_cents,
                    human_decision(accepted|edited|rejected|pending), human_diff_json,
                    created_at
```

## 6.5 Tournées

```
tours               id, org_id, date, assigned_user_id, status(draft|published|running|closed),
                    start_location point, end_location point,
                    planned_distance_m, planned_duration_s,
                    actual_distance_m, actual_duration_s,
                    optimization_run_id
optimization_runs   id, tour_id, algorithm, params_json, before_metrics, after_metrics,
                    accepted boolean, created_at
```

## 6.6 Transmissions

```
transmissions       id, org_id, visit_id, patient_id, author_user_id,
                    audio_url, audio_duration_s, raw_transcript_enc,
                    structured_json,     -- {observations, actes, douleur_eva, constantes, alertes, suite}
                    final_text_enc, status(draft|validated),
                    validated_at, ai_proposal_id
vital_signs         id, patient_id, visit_id, type(tension|glycemie|temperature|poids|spo2|eva),
                    value numeric, value2 numeric, unit, measured_at, source(manual|voice|device)
```

## 6.7 Administratif et finance

```
admin_tasks         id, org_id, type, title, description, due_date, priority,
                    related_resource_type, related_resource_id,
                    status(open|snoozed|done), auto_generated boolean, rule_key
documents           id, org_id, patient_id, type, name, file_url, expires_at, uploaded_by
invoices_mirror     id, org_id, patient_id, visit_id, external_ref, amount_cents,
                    status(pending|paid|rejected|unpaid), rejected_reason_code,
                    rejected_at, source(manual|import_csv)
mileage_logs        id, org_id, user_id, date, distance_km, is_professional, tour_id
```

Note : `invoices_mirror` est un **miroir déclaratif** de ce qui se passe dans le logiciel agréé. IDEL OS ne facture pas, il suit.

## 6.8 Chiffrement et RLS

- Champs suffixés `_enc` : chiffrés au niveau applicatif (AES-256-GCM, clé par organisation dérivée d'une master key en KMS/Vault). Le chiffrement se fait dans une couche Drizzle custom type, transparente pour le code métier.
- Ne chiffre pas les champs nécessaires aux index géographiques (`postal_code`, `city`, `geo`) : documente le compromis.
- **Row Level Security activée sur toutes les tables**, policy par `org_id` avec `current_setting('app.current_org_id')`. Écris un test qui prouve qu'un utilisateur de l'org A ne peut lire aucune ligne de l'org B, table par table, généré automatiquement.

---

# 7. MODULES DÉTAILLÉS

## M1 : Ordonnances et OCR

### User stories

- En tant qu'IDEL, je photographie une ordonnance et j'obtiens en moins de 12 secondes une fiche structurée que je peux corriger.
- Je peux importer un PDF (ordonnance dématérialisée) ou saisir manuellement.
- Chaque champ extrait affiche un indice de confiance ; sous 0,8 le champ est surligné et demande vérification.
- Je peux photographier plusieurs pages d'une même ordonnance.
- Je vois toujours la photo originale à côté de l'extraction, pour vérifier d'un coup d'œil.

### Pipeline technique

```
1. Capture      expo-camera, guides de cadrage, détection de bords, flash auto
2. Prétraitement  redressement (perspective), déskew, débruitage, binarisation adaptative,
                  compression intelligente. Fait ON DEVICE quand possible.
3. Upload       chiffré, S3 HDS, URL signée 5 min
4. OCR          moteur principal + fallback. Sortie : texte + bounding boxes
5. Redaction    packages/phi-redaction retire les identifiants directs
6. Extraction   LLM vision + texte → JSON validé par Zod (schéma PrescriptionExtraction)
7. Ré-hydratation  ré-injection des identifiants côté serveur
8. Confiance    score par champ, croisement OCR / LLM / règles de plausibilité
9. Persistance  prescription + prescription_items en statut draft
10. Revue       écran de validation humaine, diff visuel, puis status=validated
```

### Schéma d'extraction (Zod, dans `packages/shared`)

```ts
const PrescriptionExtraction = z.object({
  prescriber: z.object({
    name: z.string().nullable(),
    rpps: z.string().regex(/^\d{11}$/).nullable(),
    speciality: z.string().nullable(),
    confidence: z.number().min(0).max(1),
  }),
  patient: z.object({
    lastName: z.string().nullable(),
    firstName: z.string().nullable(),
    birthDate: z.string().date().nullable(),
    confidence: z.number(),
  }),
  prescribedAt: z.string().date().nullable(),
  durationDays: z.number().int().positive().nullable(),
  isRenewable: z.boolean().nullable(),
  items: z.array(z.object({
    rawText: z.string(),
    actType: z.enum([
      'injection_sc','injection_im','injection_iv','perfusion',
      'pansement_simple','pansement_lourd','pansement_chirurgical',
      'glycemie','insuline','sondage_urinaire','soins_nursing',
      'prise_de_sang','vaccination','surveillance','autre',
    ]),
    description: z.string(),
    frequency: z.object({
      timesPerDay: z.number().int().positive().nullable(),
      everyNDays: z.number().int().positive().nullable(),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable(),
      asNeeded: z.boolean(),
    }),
    durationDays: z.number().int().positive().nullable(),
    timeConstraints: z.array(z.string()),
    confidence: z.number(),
  })),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
    field: z.string().nullable(),
  })),
  globalConfidence: z.number(),
})
```

### Règles de plausibilité (déterministes, après extraction)

- Une ordonnance de plus de 3 mois pour un pansement jusqu'à cicatrisation : alerte.
- Date de prescription dans le futur, ou de plus de 12 mois : alerte bloquante.
- RPPS invalide (longueur ou clé) : alerte.
- Fréquence > 4 passages/jour : demande confirmation.
- Absence de durée : bloquant, il faut la saisir.

---

## M2 : LE MOTEUR NGAP (module le plus important)

### 2.1 Philosophie

Le moteur NGAP est un **système expert déterministe**, versionné, sourcé, testable. Le LLM ne fait qu'interpréter l'entrée en langage naturel et expliquer la sortie. Jamais décider.

### 2.2 Architecture

```
packages/ngap-engine/
├── src/
│   ├── catalog/          # actes, lettres-clés, coefficients, tarifs historisés
│   ├── rules/            # règles déclaratives, une par fichier, sourcée
│   ├── engine/
│   │   ├── evaluate.ts   # applique le catalogue et les règles à un contexte
│   │   ├── cumul.ts      # règles de cumul et d'abattement
│   │   ├── majorations.ts
│   │   ├── deplacement.ts # IFD/IK
│   │   └── explain.ts    # produit une justification structurée
│   ├── types.ts
│   └── index.ts
├── rules-data/           # JSON/YAML des règles, versionnés, avec source et date
└── test/
    ├── cases/            # ⭐ cas de test métier, un fichier par scénario réel
    └── engine.test.ts
```

### 2.3 DSL de règle (format à implémenter)

```yaml
id: cumul-second-acte-50
version: "2026-06-21"
type: cumul
title: "Abattement de 50 % sur le deuxième acte"
ngap_article_ref: "Article 11B des dispositions générales"
source_url: "https://www.ameli.fr/..."
source_date: "2026-06-21"
severity: info
condition:
  all:
    - acts_count: { gte: 2 }
    - same_visit: true
    - not: { any: [ { has_tag: "cumul_full_exempt" } ] }
effect:
  apply_rate:
    target: second_highest_act
    rate: 0.5
  and:
    apply_rate:
      target: other_acts
      rate: 0
explanation_template: >
  Lorsque plusieurs actes sont réalisés au cours de la même séance,
  le second est pris en charge à 50 % et les suivants ne sont pas facturés,
  sauf exceptions prévues par la nomenclature.
```

Le moteur doit gérer au minimum ces familles de règles :

| Famille | Contenu |
|---|---|
| **Lettres-clés et coefficients** | AMI, AMX, AIS, BSI, DI, AMC, avec coefficients et tarifs historisés par date |
| **Cumul** | 100 % / 50 % / 0 %, exceptions, actes cumulables à taux plein |
| **Séries** | actes en série, forfaits, limitations de nombre |
| **Majorations** | MAU, MCI, MIE (patients de moins de 7 ans), dimanche/férié, nuit, jour férié |
| **Déplacement** | IFD, IK plaine/montagne/pied, franchise kilométrique, calcul depuis le cabinet |
| **BSI** | forfaits (léger, intermédiaire, lourd), incompatibilités avec AIS, conditions de mise en place |
| **Pansements** | depuis le 21 juin 2026, distinction plaie **non chirurgicale** vs **chirurgicale simple** (AMI 2,02 chacun), et prescription jusqu'à cicatrisation plafonnée à 3 mois |
| **Administration médicamenteuse** | AMI 1,2, élargie aux troubles neurologiques, psychiatriques, cognitifs, sensoriels ou moteurs, voies orale, ophtalmique, auriculaire, nasale, cutanée, vaginale, rectale, **facturable une seule fois par passage** |
| **Exonérations** | ALD, maternité, AT/MP, CMU-C/C2S |
| **Conditions de prescription** | actes nécessitant une prescription, durée de validité |

⚠️ **Instruction critique à l'agent** : tu ne connais pas la NGAP par cœur et tes souvenirs sont périmés. Pour chaque règle :
1. Crée le fichier de règle avec la structure complète mais un champ `status: "TO_VERIFY"`.
2. Cite ta source et la date.
3. Génère `docs/ngap/A-VERIFIER.md` listant toutes les règles à faire valider par une IDEL ou un formateur cotation avant mise en production.
4. **Le moteur refuse de démarrer en production s'il reste des règles `TO_VERIFY` actives.** Implémente ce garde-fou.

Les tarifs et coefficients doivent être des **données**, jamais des constantes dans le code, avec une date de validité, pour absorber les revalorisations (par exemple, l'AMI est à 3,15 € en juin 2026 avec une hausse annoncée en novembre 2026 : le moteur doit gérer les deux périodes sans redéploiement).

### 2.4 API du moteur

```ts
type CodingContext = {
  patient: { isALD: boolean; isDiabetic: boolean; age: number; exemption?: ExemptionType }
  visit:   { at: Date; isSunday: boolean; isHoliday: boolean; isNight: boolean; isHomeVisit: boolean }
  acts:    Array<{ catalogId: string; quantity: number; tags: string[] }>
  travel:  { fromCabinetKm: number; zone: 'plaine'|'montagne'|'pied'; isFirstOfTour: boolean }
  history: { sameDayVisits: VisitRef[]; seriesProgress: Record<string, number> }
  date:    Date  // pour sélectionner la version tarifaire applicable
}

type CodingResult = {
  lines: CodingLine[]
  totalCents: number
  alerts: Alert[]          // blocking | warning | info | opportunity
  appliedRules: RuleRef[]  // traçabilité complète
  explanation: Explanation // structure, pas du texte libre
  confidence: 'certain' | 'likely' | 'ambiguous'
}

function evaluate(ctx: CodingContext): CodingResult
```

`evaluate` est **pure**, synchrone, sans I/O, sans appel réseau. C'est ce qui la rend testable exhaustivement.

### 2.5 Les deux alertes qui vendent le produit

```ts
// Sous-cotation
{
  severity: 'opportunity',
  code: 'MISSING_MCI',
  message: "Ce patient est en ALD et le soin semble éligible à la majoration MCI, non ajoutée.",
  potentialGainCents: 500,
  suggestedFix: { addLine: { ... } }
}

// Risque de rejet
{
  severity: 'blocking',
  code: 'CUMUL_NOT_ALLOWED',
  message: "Ces deux actes ne sont pas cumulables au cours de la même séance selon l'article X.",
  ruleRef: 'cumul-ami-ais-2026',
  suggestedFix: { removeLine: '...' }
}
```

Chaque alerte `opportunity` alimente le compteur « argent oublié » du dashboard. C'est la mécanique de rétention.

### 2.6 Le copilote NGAP conversationnel

L'IDEL écrit ou dicte en langage naturel :
> « Mme M., pansement lourd plus injection, diabétique, 2 passages par jour pendant 15 jours, à 8 km du cabinet. »

Pipeline :
1. **Redaction** (aucun nom ne part vers le LLM).
2. **LLM extraction** → `CodingContext` partiel validé par Zod. Le LLM ne produit **jamais** de lettre-clé ni de montant, seulement une description structurée des faits.
3. **Questions de complétion** : si des champs manquent, poser 1 à 3 questions fermées et rapides à répondre au pouce.
4. **`evaluate(ctx)`** : la cotation sort du moteur.
5. **LLM explication** : reformule `CodingResult` en français clair. Prompt contraint : « Tu reçois un résultat de cotation déjà calculé. Reformule-le. Tu n'as pas le droit d'ajouter, retirer ou modifier une ligne, un code ou un montant. »
6. **Affichage** avec bouton Valider / Modifier / Rejeter, tracé dans `ai_proposals`.

---

## M3 : Plan de soins et passages

- Génération de la récurrence à partir de `frequency_json` : gérer tous les cas (n fois par jour, tous les n jours, jours de la semaine, à la demande, jours fériés).
- Fenêtres horaires par passage (matin 6h30-9h, soir 17h-20h) modifiables patient par patient.
- Durée estimée par acte, initialisée depuis le catalogue puis **apprise** à partir des durées réelles constatées (checkin/checkout), par IDEL et par patient. Ce petit modèle statistique local (médiane glissante) suffit et vaut mieux qu'un LLM.
- Gestion des exceptions : patient hospitalisé, absent, refus de soin, report.
- Alerte automatique à J-7 et J-3 sur les prescriptions arrivant à échéance, avec préparation de la demande de renouvellement.

---

## M4 : Tournée et optimisation

### Problème à modéliser

Il s'agit d'un **VRPTW** (Vehicle Routing Problem with Time Windows) avec contraintes réelles :

- fenêtres horaires par patient (dures ou souples),
- durée de soin variable,
- contraintes médicales de séquencement (insuline avant repas, certains soins à heure fixe),
- plusieurs passages par jour pour un même patient, espacés d'un intervalle minimal,
- plusieurs IDEL, avec compétences et affectations préférentielles,
- pause obligatoire,
- retour au cabinet, dépôt de prélèvements au laboratoire avant une heure limite,
- continuité relationnelle : un patient préfère voir la même infirmière (contrainte souple, à pénaliser plutôt qu'à interdire).

### Approche recommandée

1. Matrice de temps de trajet réels via **OSRM auto-hébergé** (données OSM France), pas de distance à vol d'oiseau.
2. Solution initiale : heuristique de construction (insertion la moins coûteuse).
3. Amélioration : **recherche locale à grand voisinage (LNS)** ou recuit simulé, budget temps borné à 3 secondes côté serveur.
4. Bibliothèque : **Google OR-Tools** (via un microservice Python) ou **VROOM** (C++, open source, conçu exactement pour ça et compatible OSRM). VROOM est le choix par défaut : plus simple à opérer.
5. Fonction objectif multi-critères pondérée, paramétrable par l'utilisateur :
   `w1 × distance + w2 × durée + w3 × violations de fenêtres + w4 × ruptures de continuité + w5 × déséquilibre de charge entre IDEL`

### Contrat UX

Ne jamais réorganiser une tournée sans le dire. Toujours présenter :

```
Tournée actuelle : 36 patients, 112 km, 4 h 20 de trajet
Proposition       : 36 patients,  91 km, 3 h 46 de trajet

Gain : -21 km, -34 min
Aucun horaire patient décalé de plus de 10 minutes.
3 patients changent de position (voir le détail)

[ Voir les changements ]   [ Appliquer ]   [ Ignorer ]
```

Le diff visuel avant/après est obligatoire. L'IDEL doit pouvoir **verrouiller** certains passages (« celui-là ne bouge pas ») avant relance de l'optimisation.

---

## M5 : Transmission vocale

### Flux

1. Bouton unique, gros, accessible depuis la fiche du passage. Appui long pour enregistrer, ou mains libres.
2. Enregistrement local, chiffré, transcription **on-device si possible** (Whisper small quantisé, ou API native iOS/Android) pour éviter de faire sortir de l'audio de santé. Fallback serveur sur infra HDS.
3. Redaction, puis structuration LLM vers un schéma clinique strict.
4. Écran de validation : texte structuré à gauche, transcription brute à droite, corrections au doigt.
5. Constantes détectées (tension, glycémie, EVA, température) extraites en champs typés et poussées dans `vital_signs`, avec graphiques d'évolution.

### Schéma de transmission (Zod)

```ts
const Transmission = z.object({
  actsPerformed: z.array(z.object({ label: z.string(), conformToProtocol: z.boolean().nullable() })),
  observations: z.array(z.string()),
  vitals: z.array(z.object({
    type: z.enum(['tension','glycemie','temperature','poids','spo2','eva','frequence_cardiaque']),
    value: z.number(), value2: z.number().nullable(), unit: z.string(),
  })),
  painEva: z.number().min(0).max(10).nullable(),
  concerns: z.array(z.object({
    text: z.string(),
    urgency: z.enum(['info','a_surveiller','a_signaler']),
  })),
  nextVisitNotes: z.string().nullable(),
  missingInfo: z.array(z.string()),   // "température non mesurée, à préciser"
})
```

### Règles de rédaction pour le LLM

- Vocabulaire infirmier professionnel, phrases courtes, voix passive descriptive.
- **Ne jamais inventer** une donnée non dite. Si l'IDEL n'a pas parlé de fièvre, écrire « température non mesurée » dans `missingInfo`, pas « absence de fièvre ».
- Ne jamais poser de diagnostic ni proposer de conduite à tenir médicale.
- Distinguer explicitement l'observé du rapporté (« le patient rapporte » vs « observé »).
- Sortie en français, orthographe et accords vérifiés.

---

## M6 : Assistant administratif

Écran unique répondant à « Qu'est-ce que je dois régler aujourd'hui ? », alimenté par des **règles déterministes** qui génèrent des `admin_tasks` :

| Règle | Déclencheur |
|---|---|
| Ordonnance à renouveler | `valid_until` à J-7 puis J-3 |
| Pièce justificative manquante | prescription validée sans `original_file_url` |
| Rejet à traiter | `invoices_mirror.status = rejected` |
| Facture impayée | `pending` depuis plus de 30 jours |
| Contrat de remplacement à renouveler | `memberships.ends_at` à J-15 |
| Document expirant | `documents.expires_at` à J-30 |
| Prescription se terminant | `care_plans.ends_at` cette semaine |
| Patient sans passage depuis N jours | plan actif sans visite |
| Transmission non validée | `transmissions.status = draft` depuis plus de 48 h |

Chaque tâche a une **action en un tap** : générer le courrier de renouvellement, appeler le prescripteur, marquer comme traité, reporter.

Sur les remplacements : depuis les évolutions conventionnelles récentes, plusieurs formalités existent (autorisation, contrat, période, CPS du remplaçant). Modélise-les comme un checklist paramétrable dans `docs/ngap/remplacement.md` avec le même statut `TO_VERIFY`.

---

## M7 : Dashboard « argent oublié »

```
Ce mois-ci
  CA facturé (déclaré)         18 420 €
  Encaissé                     16 980 €
  En attente                    1 440 €
  Rejets                          340 €
  Sous-cotation détectée          210 €   ← somme des alertes 'opportunity' non traitées
  Km professionnels             1 842 km
  Temps de tournée                126 h
  Revenu par heure travaillée     146 €/h

7 actions recommandées → potentiel +430 €
  [ Voir les actions ]
```

Règles d'honnêteté à coder :
- Ne jamais afficher un montant non calculable : afficher « données incomplètes » avec le moyen de compléter.
- La « sous-cotation détectée » est un **potentiel**, formulé comme tel, jamais comme un dû.
- Toute métrique doit être cliquable et remonter à ses lignes sources.

---

## M11 : L'agent conversationnel (le différenciant)

À terme, l'IDEL parle à son logiciel. Implémente un agent avec **tool calling** sur des outils typés et sécurisés :

```
searchPatients(query)              getPatient(id)
createVisit(patientId, when, acts) rescheduleVisit(visitId, when)
proposeCoding(context)             explainRejection(invoiceId)
optimizeTour(date, constraints)    listExpiringPrescriptions(days)
getFinancialSummary(period)        draftRenewalRequest(prescriptionId)
listAdminTasks()                   summarizePatientHistory(patientId)
```

Contraintes :
- Chaque tool est soumis à la RLS et aux permissions de rôle.
- Aucune action **mutante** n'est exécutée sans confirmation explicite, présentée sous forme de diff.
- L'agent n'a jamais accès direct à la base : il passe par les mêmes procédures tRPC que l'UI.
- Les identifiants patients réels ne partent pas vers le LLM : l'agent manipule des handles opaques, résolus côté serveur.
- Chaque tour d'agent est enregistré dans `ai_proposals` avec coût et latence.

---

# 8. DESIGN ET UX

## 8.1 Principes

1. **Une main, un pouce.** Toutes les actions primaires dans le tiers inférieur de l'écran.
2. **Cibles tactiles de 56 px minimum.** L'utilisatrice porte parfois des gants.
3. **Contraste élevé**, lisible en plein soleil dans une voiture. Mode sombre pour les tournées de 5h du matin.
4. **Trois taps maximum** pour toute action quotidienne.
5. **Aucun écran vide sans action proposée.**
6. **États de chargement informatifs** : « Lecture de l'ordonnance... », « Analyse des soins... », « Vérification des règles NGAP... ». Jamais un spinner nu.
7. **Confiance visible** : tout ce qui vient de l'IA est visuellement distinct (fond légèrement teinté + icône), avec son niveau de confiance.
8. **Undo partout.** Aucune action destructrice sans annulation possible pendant 10 secondes.

## 8.2 Écrans du MVP

1. **Aujourd'hui** : la tournée du jour, patient suivant en gros, ETA, bouton « Démarrer ».
2. **Passage** : fiche patient, accès (code portail, étage), actes à faire, checklist, bouton transmission vocale, bouton « Terminé ».
3. **Scanner** : capture d'ordonnance plein écran avec guides.
4. **Revue d'extraction** : photo à gauche, champs extraits à droite, confiance par champ, correction en ligne.
5. **Cotation** : lignes, montant total, alertes, explication dépliable, boutons Valider / Modifier / Copier pour le logiciel de facturation.
6. **Patient** : identité, plan de soins, historique, documents, constantes.
7. **À régler** : les `admin_tasks`.
8. **Réglages** : cabinet, tarifs, zones IK, préférences d'optimisation, export.

## 8.3 Ton de l'interface

Français professionnel, vouvoiement, jamais infantilisant, jamais de jargon informatique. Pas d'emoji dans l'UI produit. Les messages d'erreur disent quoi faire, pas ce qui a planté.

---

# 9. IA : GOUVERNANCE ET COÛTS

## 9.1 Gestion des prompts

- Tous les prompts vivent dans `packages/llm/prompts/`, versionnés, un fichier par prompt, avec en-tête : id, version, modèle cible, schéma d'entrée, schéma de sortie, changelog.
- Chaque prompt a un **jeu d'évaluation** dans `packages/llm/evals/` : au minimum 30 cas par prompt avec sortie attendue. La CI fait tourner les évaluations et échoue si le score régresse.
- Aucun prompt n'est modifié sans incrémenter sa version et relancer les évaluations.

## 9.2 Routage et coûts

- Router par tâche : un petit modèle rapide pour la classification et la structuration simple, un gros modèle pour l'extraction d'ordonnance complexe et le raisonnement.
- Cache agressif : une même ordonnance re-scannée ne repaye pas l'extraction (hash de l'image).
- Budget par organisation, compteur de coût par utilisateur, alerte à 80 % du budget, dégradation gracieuse plutôt que coupure.
- Objectif de marge : coût IA inférieur à **15 %** du prix de l'abonnement. Instrumente `ai_proposals.cost_cents` dès le premier jour et affiche un tableau de bord interne.

## 9.3 Boucle d'amélioration

Chaque correction humaine d'une proposition IA (`human_diff_json`) est un signal d'or. Construis dès M2 :
- un export anonymisé des diffs,
- un tableau des erreurs les plus fréquentes par type,
- un processus de mise à jour des prompts et des règles à partir de ces données.

C'est votre moat : après 6 mois d'usage, personne ne peut rattraper ce dataset.

---

# 10. OFFLINE ET SYNCHRONISATION

- Modèle : source de vérité serveur, cache local complet des données du jour et J+7.
- File d'actions locale, persistante, rejouable, avec identifiants générés côté client (UUID v7).
- Résolution de conflits : last-write-wins sur les champs simples, **jamais** sur une cotation validée ou une transmission validée (celles-ci deviennent immuables, toute modification crée une nouvelle version).
- Indicateur de synchronisation visible en permanence : nombre d'éléments en attente, dernière synchro réussie.
- Test obligatoire : mode avion pendant une tournée complète de 20 passages, puis reconnexion. Zéro perte, zéro doublon.

---

# 11. TESTS ET QUALITÉ

| Type | Périmètre | Outil | Seuil |
|---|---|---|---|
| Unitaires | `ngap-engine`, `routing`, `phi-redaction`, `sync` | Vitest | 90 % |
| Intégration | procédures tRPC, RLS, migrations | Vitest + Testcontainers | 80 % |
| Golden tests | cas NGAP réels | Vitest snapshot | 100 % des cas connus |
| Évaluations IA | prompts | harness maison | pas de régression |
| E2E web | parcours cabinet | Playwright | parcours critiques |
| E2E mobile | scan → cotation → tournée | Maestro | parcours critiques |
| Sécurité | RLS, injection, secrets, dépendances | test généré + gitleaks + audit | 0 fuite |
| Charge | 200 IDEL simultanées en début de tournée à 6h30 | k6 | p95 < 500 ms |

**Cas de test NGAP** : crée `packages/ngap-engine/test/cases/` avec un fichier par scénario réel, format lisible par une IDEL non technique :

```yaml
name: "Pansement lourd + injection SC, patient ALD diabétique, dimanche, 6 km"
given:
  patient: { isALD: true, isDiabetic: true, age: 72 }
  visit:   { at: "2026-09-13T08:00:00+02:00", isHomeVisit: true }
  acts:    [ { key: "pansement_lourd" }, { key: "injection_sc" } ]
  travel:  { fromCabinetKm: 6, zone: "plaine" }
expect:
  lines: [ ... ]
  totalCents: ____
  alerts: [ ... ]
status: TO_VERIFY          # ← à faire valider par une IDEL
verified_by: null
verified_at: null
```

Ces fichiers sont le contrat entre le produit et le métier. Ils doivent être relus par un humain compétent avant toute mise en production.

---

# 12. SÉCURITÉ APPLICATIVE

- Secrets en variables d'environnement, jamais en dur, `gitleaks` en pre-commit.
- Rate limiting par IP et par utilisateur sur toutes les routes, strict sur l'upload et les endpoints IA.
- Validation Zod de **toute** entrée, y compris interne.
- Headers de sécurité complets, CSP stricte sur le web.
- Chiffrement des sauvegardes, test de restauration mensuel automatisé.
- Verrouillage de l'app par biométrie après 5 minutes d'inactivité, obligatoire, non désactivable.
- Effacement à distance en cas de perte du téléphone (invalidation de session + purge du cache local au prochain démarrage).
- Politique de mot de passe : 12 caractères minimum, vérification contre la liste des mots de passe compromis (k-anonymity HIBP).
- Pas de données de santé dans les logs, jamais. Scrubber automatique + test qui échoue si un pattern de donnée personnelle apparaît dans un log.

---

# 13. BUSINESS ET FACTURATION

```
SOLO      29 €/mois    1 IDEL, scan d'ordonnances, copilote NGAP, transmissions, tournée
PRO       59 €/mois    SOLO + automatisations, analytics financiers, suivi des rejets,
                       documents, kilomètres, agent conversationnel
CABINET  129 €/mois    jusqu'à 5 IDEL, planning collaboratif, remplacements,
                       transmissions d'équipe, statistiques cabinet
                       (+ 20 €/mois par IDEL supplémentaire)
```

À implémenter côté code :
- Feature flags par plan, centralisés dans `packages/shared/plans.ts`.
- Essai gratuit 14 jours sans carte bancaire.
- Quotas IA par plan, avec compteur visible.
- Stripe Billing, portail client, webhooks idempotents.
- Aucune donnée de santé côté Stripe.

---

# 14. GO-TO-MARKET INTÉGRÉ AU PRODUIT

Fonctionnalités à construire parce qu'elles font la croissance :

1. **Onboarding en 5 minutes** : compte, cabinet, import d'une première ordonnance de test fournie, première cotation, effet « waouh » avant toute saisie de données réelles.
2. **Mode démo** avec données fictives, accessible sans compte, partageable par lien. C'est l'outil de vente.
3. **Parrainage** : 1 mois offert pour chaque IDEL parrainée qui reste 2 mois.
4. **Export permanent** : l'utilisatrice peut tout récupérer à tout moment, argument de confiance majeur dans ce marché.
5. **Page publique « Le calculateur NGAP gratuit »** : version limitée du moteur, sans compte, pour le SEO et la génération de leads. C'est le meilleur canal d'acquisition possible sur ce marché.

---

# 15. RISQUES ET MITIGATIONS

| Risque | Gravité | Mitigation |
|---|---|---|
| Règles NGAP fausses → cotation erronée | Critique | Moteur déterministe, règles sourcées, statut TO_VERIFY, validation métier obligatoire, disclaimer, audit log |
| Fuite de données de santé | Critique | HDS, chiffrement applicatif, RLS, pseudonymisation avant LLM, tests de sécurité en CI |
| Requalification en dispositif médical | Élevée | Périmètre strictement administratif, ADR dédié, aucune recommandation de soin |
| Extraction d'ordonnance peu fiable | Élevée | Revue humaine obligatoire, score de confiance, apprentissage sur les corrections |
| Adoption faible (l'IDEL a déjà un logiciel) | Élevée | Positionnement en complément, pas en remplacement, wedge très étroit, export vers le logiciel existant |
| Coûts IA supérieurs à la marge | Moyenne | Routage, cache, quotas, instrumentation dès J1 |
| Évolution réglementaire (NGAP, avenants) | Moyenne | Règles en données versionnées avec dates de validité, jamais en dur |
| Dépendance à un fournisseur LLM | Moyenne | Abstraction multi-fournisseurs, évaluations automatisées à chaque bascule |

---

# 16. ROADMAP D'EXÉCUTION

| Sprint | Durée | Livrable | Critère de sortie |
|---|---|---|---|
| S0 | 3 j | Monorepo, CI, docker-compose, schéma DB, RLS, audit log, seed | `pnpm test` vert, RLS prouvée par test |
| S1 | 5 j | Auth + TOTP, organisations, patients, prescripteurs, chiffrement | Un compte peut créer un patient, aucune fuite inter-org |
| S2 | 7 j | `ngap-engine` v1 : catalogue, cumul, majorations, déplacement, 40 cas de test | Tous les cas passent, doc À-VERIFIER générée |
| S3 | 7 j | Pipeline OCR + extraction + écran de revue | Une photo réelle donne une extraction corrigeable en moins de 12 s |
| S4 | 5 j | Copilote NGAP : conversationnel + explication + validation | Boucle complète, tracée dans `ai_proposals` |
| S5 | 5 j | Plans de soins, génération des passages, écran Aujourd'hui | Une ordonnance scannée crée une tournée |
| S6 | 4 j | Offline + sync | Test mode avion 20 passages sans perte |
| **v0.1** | | **Wedge livrable, testable avec 20 IDEL** | |
| S7 | 7 j | Optimisation de tournée (VROOM + OSRM) + diff UX | Gain mesuré et affiché honnêtement |
| S8 | 6 j | Transmissions vocales | Transcription → structure → validation en moins de 30 s |
| S9 | 5 j | Assistant administratif + dashboard financier | Les 9 règles de tâches fonctionnent |
| **v0.2** | | **Produit vendable** | |
| S10 | 8 j | Multi-IDEL, cabinet, planning partagé | |
| S11 | 8 j | Agent conversationnel avec tool calling | |
| S12 | 5 j | Stripe, plans, quotas, onboarding, mode démo | |
| **v1.0** | | **Lancement commercial** | |

---

# 17. DEFINITION OF DONE

Une fonctionnalité n'est terminée que si **tout** est vrai :

- [ ] Types stricts, aucun `any` injustifié
- [ ] Tests unitaires écrits et passants, couverture respectée
- [ ] RLS vérifiée par un test pour toute nouvelle table
- [ ] Aucune donnée de santé dans les logs (vérifié par test)
- [ ] Toute sortie IA passe par `phi-redaction` et par un schéma Zod
- [ ] Toute proposition IA est validable/rejetable par l'humain et tracée dans `audit_log`
- [ ] Fonctionne hors ligne ou dégrade explicitement
- [ ] Accessible : contraste AA, cibles 56 px, labels d'accessibilité
- [ ] États de chargement, d'erreur et vide traités
- [ ] Migration réversible fournie
- [ ] Documentée dans `docs/`
- [ ] Aucune règle métier codée en dur : tout en données versionnées

---

# 18. RÈGLES PERMANENTES (à copier dans CLAUDE.md / .cursorrules)

```markdown
# IDEL OS - règles permanentes

## Contexte
SaaS français pour infirmiers libéraux. Données de santé. Le produit propose,
l'humain décide, un logiciel agréé tiers facture.

## Interdictions absolues
- Ne jamais implémenter de télétransmission SESAM-Vitale / FSE / DRE.
- Ne jamais envoyer de donnée identifiante patient à un LLM (passer par packages/phi-redaction).
- Ne jamais laisser un LLM produire une cotation finale sans passer par packages/ngap-engine.
- Ne jamais coder en dur un tarif, un coefficient ou une règle NGAP : tout en données datées.
- Ne jamais logger de donnée de santé.
- Ne jamais formuler une recommandation de soin ou un diagnostic.
- Ne jamais héberger de donnée de santé hors infrastructure certifiée HDS.

## Obligations
- Plan avant code, questions si ambiguïté.
- Tests avant implémentation sur la logique métier.
- Zod sur toute entrée et toute sortie LLM.
- Audit log sur toute décision humaine relative à une proposition IA.
- Mobile-first, offline-first, une main, gros doigts, mauvais réseau.
- Toute règle NGAP créée est marquée status: TO_VERIFY avec sa source et sa date,
  et listée dans docs/ngap/A-VERIFIER.md.

## Langue
Code, commentaires, commits, noms de variables : anglais.
Interface, contenus, documents produit : français, vouvoiement, professionnel.
```

---

# 19. TA PREMIÈRE RÉPONSE

Ne code rien encore. Réponds par :

1. **Ton plan** en étapes numérotées pour le Sprint 0 et le Sprint 1, avec l'arborescence exacte des fichiers que tu vas créer.
2. **Tes questions** (5 maximum) sur les décisions produit ou techniques qui te bloquent réellement.
3. **Tes désaccords** avec ce brief, s'il y en a, argumentés. Notamment sur : le choix de l'hébergeur HDS, VROOM vs OR-Tools, WatermelonDB vs PowerSync, Expo vs natif, et le découpage du wedge.
4. **Les 3 risques techniques** que tu identifies et que ce document n'a pas couverts.
5. **Ta proposition de premier livrable démontrable** : le plus petit incrément qui prouve la valeur à une IDEL en 60 secondes.

Après validation de ce plan, tu exécuteras le Sprint 0 en entier, puis tu t'arrêteras pour revue.

---

## ANNEXE A : GLOSSAIRE

| Terme | Définition |
|---|---|
| **IDEL** | Infirmier(ère) Diplômé(e) d'État Libéral(e) |
| **NGAP** | Nomenclature Générale des Actes Professionnels : définit les actes pris en charge et leurs règles de facturation |
| **AMI** | Acte Médical Infirmier (lettre-clé pour les actes techniques) |
| **AIS** | Acte Infirmier de Soins (largement remplacé par le BSI depuis 2024) |
| **BSI** | Bilan de Soins Infirmiers : forfaits pour les patients dépendants |
| **AMX** | Lettre-clé pour certains soins auprès de patients dépendants |
| **DI** | Démarche de Soins Infirmiers (dispositif antérieur au BSI) |
| **MAU** | Majoration Acte Unique |
| **MCI** | Majoration de Coordination Infirmière |
| **MIE** | Majoration Infirmier Enfant (patients de moins de 7 ans, art. 23.5 NGAP) |
| **IFD** | Indemnité Forfaitaire de Déplacement |
| **IK** | Indemnité Kilométrique (plaine, montagne, à pied) |
| **ALD** | Affection de Longue Durée (exonération du ticket modérateur) |
| **FSE** | Feuille de Soins Électronique |
| **SESAM-Vitale** | Système de télétransmission des feuilles de soins |
| **CNDA** | Centre National de Dépôt et d'Agrément (agrément des logiciels) |
| **CPS / e-CPS** | Carte de Professionnel de Santé, physique ou dématérialisée |
| **RPPS** | Répertoire Partagé des Professionnels de Santé (identifiant à 11 chiffres) |
| **PSC** | Pro Santé Connect : fédération d'identité OpenID Connect pour les professionnels de santé |
| **HDS** | Hébergeur de Données de Santé (certification obligatoire) |
| **ANS** | Agence du Numérique en Santé |
| **DMP / MSSanté** | Dossier Médical Partagé / messagerie sécurisée de santé |
| **VRPTW** | Vehicle Routing Problem with Time Windows |

## ANNEXE B : DONNÉES DE SEED À GÉNÉRER

Génère des données synthétiques réalistes et **totalement fictives** :
- 1 cabinet de 3 IDEL à Arras (62), avec coordonnées géographiques réelles de rues mais patients fictifs.
- 40 patients répartis dans un rayon de 15 km, avec des profils variés : ALD, diabétiques, personnes âgées dépendantes, post-opératoires, pédiatriques.
- 60 ordonnances couvrant tous les `actType` du schéma.
- 3 semaines de passages passés avec durées réelles simulées, pour alimenter l'apprentissage des durées et les statistiques.
- 15 cas de rejets CPAM avec des codes motifs réalistes.

Aucun nom, adresse, numéro de sécurité sociale ou date de naissance ne doit correspondre à une personne réelle. Utilise un générateur (Faker en locale fr) avec une graine fixe pour la reproductibilité.

## ANNEXE C : SOURCES À CONSULTER ET RE-VÉRIFIER

L'agent doit vérifier ces sources avant d'écrire une règle NGAP, et re-vérifier à chaque sprint :

- ameli.fr, espace « Infirmiers », rubrique nomenclature et convention
- La NGAP consolidée publiée par l'UNCAM et les décisions publiées au Journal officiel
- Les avenants à la convention nationale des infirmiers libéraux
- esante.gouv.fr et industriels.esante.gouv.fr pour le Ségur, Pro Santé Connect, MSSanté
- sesam-vitale.fr / GIE SESAM-Vitale pour les spécifications et les évolutions (SESAM-Vitale 1.40 Addendum 8 : appli carte Vitale, gestion des indemnités kilométriques infirmières)
- cnil.fr pour le référentiel des traitements de données de santé
- esante.gouv.fr pour le référentiel HDS et la liste des hébergeurs certifiés

**Aucune règle ne part en production sur la base de la mémoire d'un modèle de langage.**

---

*Fin du master prompt. Longueur volontairement exhaustive : coupe ce dont tu n'as pas besoin, mais ne devine pas ce qui manque.*
