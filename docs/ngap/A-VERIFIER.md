# Règles NGAP à faire valider

Dernière génération : 12 août 2026.

Le moteur refuse de démarrer en production tant qu'une entrée active de cette liste porte le statut `TO_VERIFY`. La présence d'une source officielle ne remplace pas la validation du périmètre, des exceptions et des cas limites par une IDEL ou un formateur en cotation.

## Règles

| Identifiant | Périmètre à valider | Source primaire | Statut |
|---|---|---|---|
| `cumul-standard` | Ordre des actes, taux 100/50/0 et exceptions applicables aux IDEL | NGAP du 21 juin 2026, dispositions générales, article 11 B | `TO_VERIFY` |
| `surveillance-same-session` | Non-cumul des actes AMI de surveillance de l'article 10 | Décision UNCAM du 2 juin 2026, article 2 | `TO_VERIFY` |
| `home-travel` | IFD, IK aller-retour, franchises plaine/montagne/pied et cas tournée | NGAP du 21 juin 2026, dispositions générales, article 13 | `TO_VERIFY` |
| `time-majorations` | Éligibilité dimanche/férié et deux plages de nuit | Tarifs conventionnels Ameli et NGAP, article 14 | `TO_VERIFY` |
| `mie-under-seven` | Actes éligibles et exceptions de la MIE | Tarifs conventionnels Ameli | `TO_VERIFY` |
| `mci-opportunity` | Critères exhaustifs d'éligibilité MCI ; l'ALD seule ne suffit jamais | Convention, avenant 3 et NGAP | `TO_VERIFY` |

## Catalogue d'actes

| Identifiant | Donnée à valider | Source primaire | Statut |
|---|---|---|---|
| `pansement-non-chirurgical` | AMI 2,02 et périmètre des plaies concernées | Décision UNCAM du 2 juin 2026, article 2 | `TO_VERIFY` |
| `pansement-chirurgical-simple` | AMI 2,02 et distinction avec les pansements lourds et complexes | Décision UNCAM du 2 juin 2026, article 2 | `TO_VERIFY` |
| `administration-medicamenteuse` | AMI 1,2, voies, troubles éligibles, accord préalable au-delà du premier mois et une facturation par passage | Décision UNCAM du 2 juin 2026, article 2 | `TO_VERIFY` |

## Tarifs

Toutes les entrées de `packages/ngap-engine/rules-data/tariffs.json` sont `TO_VERIFY`, notamment :

- AMI et AMX à 3,15 € jusqu'au 5 novembre 2026 ;
- AMI et AMX à 3,35 € à partir du 6 novembre 2026 ;
- AMI et AMX à 3,45 € à partir du 1er novembre 2027 ;
- AIS, BSA, BSB, BSC et DI ;
- IFD, IK, IKM et IKS ;
- majorations dimanche/jour férié, nuit, MCI et MIE.

## Validation attendue

Pour passer une entrée à `VERIFIED` :

1. faire relire la règle et ses exceptions par une professionnelle qualifiée ;
2. consigner le nom ou identifiant interne de la validatrice, la date et la version de la source dans le registre de validation ;
3. ajouter les cas limites demandés aux scénarios métier ;
4. modifier le statut dans les données, sans désactiver le garde-fou ;
5. faire approuver la modification par une seconde personne avant livraison production.

## Sources officielles consultées

- [NGAP, version du 21 juin 2026](https://www.ameli.fr/sites/default/files/Documents/NGAP-21062026.pdf)
- [Décision UNCAM du 2 juin 2026, article 2](https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000054280866)
- [Tarifs conventionnels applicables aux infirmiers](https://www.ameli.fr/infirmier/exercice-liberal/facturation-remuneration/tarifs-conventionnels/tarifs)
- [Avenant 11 à la convention nationale](https://www.ameli.fr/infirmier/textes-reference/convention/avenants)
