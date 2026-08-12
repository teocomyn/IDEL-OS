# IDEL OS - règles permanentes

## Contexte

SaaS français pour infirmiers libéraux. Données de santé. Le produit propose,
l’humain décide, un logiciel agréé tiers facture.

## Interdictions absolues

- Ne jamais implémenter de télétransmission SESAM-Vitale / FSE / DRE.
- Ne jamais envoyer de donnée identifiante patient à un LLM (passer par `packages/phi-redaction`).
- Ne jamais laisser un LLM produire une cotation finale sans passer par `packages/ngap-engine`.
- Ne jamais coder en dur un tarif, un coefficient ou une règle NGAP : tout en données datées.
- Ne jamais logger de donnée de santé.
- Ne jamais formuler une recommandation de soin ou un diagnostic.
- Ne jamais héberger de donnée de santé hors infrastructure certifiée HDS.

## Obligations

- Plan avant code, questions si ambiguïté.
- Tests avant implémentation sur la logique métier.
- Zod sur toute entrée et toute sortie LLM.
- Audit log sur toute décision humaine relative à une proposition IA.
- Mobile-first, offline-first, une main, gros doigts, mauvais réseau.
- Toute règle NGAP créée est marquée `status: TO_VERIFY` avec sa source et sa date,
  et listée dans `docs/ngap/A-VERIFIER.md`.

## Langue

Code, commentaires, commits, noms de variables : anglais.
Interface, contenus, documents produit : français, vouvoiement, professionnel.
