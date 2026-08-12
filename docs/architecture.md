# Architecture S0–S1

Le monorepo sépare les clients, l’API et les règles métier. L’API est la seule porte d’entrée
vers PostgreSQL et fixe le contexte d’organisation dans la transaction. Les données sensibles
sont chiffrées avant persistence. Les journaux ne reçoivent que des identifiants techniques.

```text
Mobile/Web -> Fastify + tRPC -> transaction RLS -> PostgreSQL
                     |                  |
                     |                  +-> audit append-only
                     +-> sync queue / jobs
```

Les packages IA, OCR, NGAP et tournée sont réservés mais ne sont pas implémentés pendant S0–S1.
