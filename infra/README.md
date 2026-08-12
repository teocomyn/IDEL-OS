# Infrastructure locale

Cette infrastructure est réservée aux données synthétiques.

```bash
pnpm infra:up
pnpm db:migrate
pnpm test
```

MinIO, Mailpit, Redis et PostgreSQL sont exposés uniquement pour le développement local.
