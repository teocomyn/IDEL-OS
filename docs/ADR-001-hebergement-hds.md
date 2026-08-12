# ADR-001 — Hébergement des données de santé

- Statut : accepté pour l’architecture, contractualisation requise avant production
- Date : 12 août 2026

## Décision

La cible initiale est l’offre HDS de Scaleway dans les régions parisiennes et uniquement
les produits explicitement inclus dans son périmètre HDS. PostgreSQL, Redis, stockage objet,
sauvegardes, journaux applicatifs et calcul contenant des données de santé doivent rester
dans ce périmètre.

L’environnement local repose sur Docker et ne contient que des données synthétiques.
Le front statique peut être distribué ailleurs à condition qu’aucune donnée de santé ne soit
traitée, journalisée ou mise en cache par ce fournisseur.

## Conditions de mise en production

1. Vérifier Scaleway dans la liste ANS des hébergeurs certifiés et contrôler le certificat.
2. Signer le contrat HDS et confirmer la matrice de responsabilité partagée.
3. Restreindre chaque ressource aux offres et régions couvertes.
4. Valider les sauvegardes, KMS, journaux, sous-traitants et procédures de suppression.

## Sources vérifiées

- ANS, liste des hébergeurs certifiés : https://esante.gouv.fr/offres-services/hds/liste-des-hebergeurs-certifies
- Scaleway, offre HDS : https://www.scaleway.com/fr/security-and-resilience/hds/
- Scaleway, responsabilité partagée des instances :
  https://www.scaleway.com/en/docs/instances/reference-content/instances-shared-responsibility-model/
- Consultation : 12 août 2026.
