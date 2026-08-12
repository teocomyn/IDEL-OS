# Pilote fermé — Emma puis 5 à 10 IDEL

Le pilote ne commence qu’après ouverture de l’environnement HDS, validation sécurité et recueil des accords. Aucun dossier réel ne doit être utilisé sur la démo publique.

## Vague 0 — Emma

Durée recommandée : 2 semaines, sur un cabinet et un nombre réduit de patients consentants.

Parcours à tester : photo/PDF → contrôle qualité → extraction → correction de chaque champ → plan de soins → tournée → transmission → proposition de cotation.

Critères d’arrêt immédiat : mauvaise association patient/document, fuite de donnée, champ non relu pouvant être validé, règle NGAP non sourcée présentée comme certaine, indisponibilité empêchant l’accès aux informations essentielles.

## Vague 1 — 5 à 10 IDEL

Recruter des profils variés : titulaire, remplaçante, cabinet à plusieurs IDEL, zone rurale avec IK et activité incluant dépendance/BSI.

Mesures hebdomadaires :

- temps ordonnance → plan validé ;
- taux de champs OCR corrigés, par type de champ ;
- taux de nouvelle photo pour flou/reflet/cadrage ;
- temps de transmission par patient ;
- désaccords sur cotation, règle et motif ;
- incidents de confidentialité et erreurs bloquantes ;
- score d’utilité et verbatims, sans donnée patient.

## Décision de sortie

La pilote valide ou refuse chaque extension. Le passage en disponibilité générale exige zéro incident de confidentialité critique, 100 % des validations humaines tracées et toutes les règles NGAP actives au statut `VERIFIED`.
