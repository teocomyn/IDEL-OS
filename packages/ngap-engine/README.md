# Moteur NGAP IDEL OS

Moteur déterministe et synchrone de proposition de cotation. Il ne réalise aucun appel réseau et ne dépend d'aucun LLM.

## Garanties actuelles

- catalogue, tarifs et règles datés dans `rules-data/` ;
- 41 scénarios métier synthétiques dans `test/cases/` ;
- résultat structuré avec lignes, alertes, règles appliquées et explication ;
- refus de démarrage en production tant qu'une entrée active est `TO_VERIFY` ;
- aucune télétransmission et aucune donnée patient identifiante.

## Version réglementaire

Le manifeste `rules-data/source-manifest.json` conserve la NGAP du 28 mai 2026 pour les soins historiques et désigne la NGAP du 21 juin 2026 comme version courante. Les échéances tarifaires AMI/AMX de l’avenant 11 sont datées dans `tariffs.json`.

Le catalogue exécutable n’est volontairement **pas déclaré complet** : seules les entrées relues et couvertes par des scénarios doivent être activées. Le moteur reste bloqué en production tant que la validation experte consignée dans `docs/ngap/A-VERIFIER.md` n’est pas terminée.

## Commandes

```bash
pnpm --filter @idel-os/ngap-engine test
pnpm --filter @idel-os/ngap-engine test:coverage
pnpm --filter @idel-os/ngap-engine typecheck
```

Les résultats restent des propositions à valider par un professionnel. La liste des validations métier requises est maintenue dans `docs/ngap/A-VERIFIER.md`.
