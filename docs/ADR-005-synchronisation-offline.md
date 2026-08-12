# ADR-005 — Synchronisation offline

- Statut : accepté
- Date : 12 août 2026

Le serveur reste la source de vérité. Les clients génèrent des identifiants UUID v7 et placent
les mutations dans une file locale persistante. Une clé d’idempotence empêche les doublons.

Les champs simples utilisent une version serveur et une résolution explicite. Une cotation ou
une transmission validée est immuable : toute correction crée une nouvelle version. S0 livre
les contrats et la logique de file ; l’intégration mobile complète et le scénario hors ligne de
20 passages sont livrés en S6.
