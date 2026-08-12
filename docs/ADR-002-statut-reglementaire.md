# ADR-002 — Statut réglementaire

- Statut : accepté
- Date : 12 août 2026

IDEL OS reste un outil administratif d’aide à la cotation. Il extrait une prescription,
applique des règles déterministes et soumet une proposition à la validation du professionnel.
Il ne diagnostique pas, ne prescrit pas, ne modifie pas une prescription et ne recommande
aucune conduite de soin.

Chaque proposition est présentée comme automatique, modifiable et non opposable. La décision
humaine et la proposition originale sont conservées dans l’audit trail.

## Fonctionnalités interdites

- diagnostic ou score orientant une décision thérapeutique ;
- recommandation de traitement, de dose ou de conduite à tenir ;
- modification automatique d’un plan de soin ;
- exécution sans validation humaine d’une décision liée au soin ;
- présentation d’une proposition administrative comme certaine ou opposable.

Une revue juridique et réglementaire indépendante reste obligatoire avant production.
