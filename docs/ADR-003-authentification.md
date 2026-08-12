# ADR-003 — Authentification

- Statut : accepté
- Date : 12 août 2026

Better Auth auto-hébergé est placé derrière l’interface interne `AuthProvider`. Le MVP utilise
email vérifié, mot de passe fort et TOTP obligatoire. L’interface réserve une intégration
OpenID Connect Pro Santé Connect sans simuler une habilitation non obtenue.

Le processus d’authentification utilise un rôle PostgreSQL dédié `idel_auth`, autorisé
uniquement sur les tables d’identité, organisations et memberships. Il peut franchir la RLS
pour retrouver une session avant de connaître l’organisation, mais ne possède aucun droit sur
les tables patient ou soin. L’API métier utilise séparément `idel_app` et une transaction RLS.

Référence technique vérifiée : https://better-auth.com/docs/
