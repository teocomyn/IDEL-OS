# Moteur NGAP IDEL OS

Moteur déterministe et synchrone de proposition de cotation. Il ne réalise aucun appel réseau et ne dépend d'aucun LLM.

## Garanties actuelles

- catalogue, tarifs et règles datés dans `rules-data/` ;
- 40 scénarios métier synthétiques dans `test/cases/` ;
- résultat structuré avec lignes, alertes, règles appliquées et explication ;
- refus de démarrage en production tant qu'une entrée active est `TO_VERIFY` ;
- aucune télétransmission et aucune donnée patient identifiante.

## Commandes

```bash
pnpm --filter @idel-os/ngap-engine test
pnpm --filter @idel-os/ngap-engine test:coverage
pnpm --filter @idel-os/ngap-engine typecheck
```

Les résultats restent des propositions à valider par un professionnel. La liste des validations métier requises est maintenue dans `docs/ngap/A-VERIFIER.md`.
