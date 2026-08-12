# Sécurité du dépôt

## Avis dépendances ouverts

Au 12 août 2026, `pnpm audit` signale deux avis de sévérité élevée dans `image-size <= 2.0.2`,
dépendance transitive de Metro via Expo :

- GHSA-w3rx-r6r6-pgpr ;
- GHSA-5p2g-fcmc-qvqq.

Aucune version corrigée n’est publiée au moment de cette décision. Le composant est utilisé au
build de l’application mobile et ne fait pas partie du backend de traitement des ordonnances.
Mesures temporaires :

1. ne jamais présenter à Metro un fichier fourni par un patient ou un utilisateur ;
2. exécuter les builds dans un runner isolé, sans secrets de production ;
3. surveiller les mises à jour Expo/Metro et appliquer la première version corrigée ;
4. bloquer toute réutilisation de cette bibliothèque dans les pipelines OCR ou d’upload.

Ce risque doit être réévalué avant chaque release et fermé avant la mise en production si une
version corrigée devient disponible.
