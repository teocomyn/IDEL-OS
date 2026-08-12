# Recette obligatoire — tournée de 20 patients hors ligne

Cette recette sur téléphone physique est bloquante avant tout pilote avec des données de santé. Elle complète le test automatisé `offline-tour-20-patients.test.ts` ; elle ne peut pas être remplacée par un simulateur.

## Préparation

- Utiliser un build iOS/Android de développement incluant SQLCipher (pas Expo Go).
- Créer une tournée strictement synthétique de 20 patients, avec au moins deux actes par passage.
- Vérifier que Face ID ou l’empreinte digitale est activé.
- Synchroniser la tournée une première fois, fermer l’application, puis activer le mode avion.

## Parcours bloquant

1. Rouvrir l’application et déverrouiller la tournée avec la biométrie.
2. Pour chaque patient, ouvrir la navigation, démarrer le passage, cocher chaque acte et terminer.
3. Tester au minimum une absence, un refus, une hospitalisation, une urgence et un report.
4. Fermer de force puis relancer l’application après le 10e patient ; vérifier que toutes les actions restent présentes.
5. Après le 20e patient, rétablir le réseau et attendre la fin de la synchronisation.
6. Vérifier en base que chaque action métier apparaît une seule fois et que les 20 statuts correspondent au téléphone.
7. Déclencher une purge distante sur un second téléphone de test ; vérifier la disparition immédiate du cache et le rejet de l’ancienne session.

## Critères d’acceptation

- aucune perte d’action après fermeture forcée ou retour du réseau ;
- aucun doublon fonctionnel après deux demandes de synchronisation simultanées ;
- aucun ancien passage après le remplacement de la tournée ;
- horaires suivants recalculés après chaque fin ou exception ;
- cache illisible sans biométrie et base locale chiffrée par SQLCipher ;
- purge distante constatée en moins de 60 secondes lorsque l’application est ouverte et connectée ;
- captures, journaux et compte rendu exclusivement synthétiques.

La recette doit être datée, signée par la testeuse IDEL et jointe au dossier de mise en production HDS.
