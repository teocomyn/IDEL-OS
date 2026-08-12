# Infrastructure locale

Cette infrastructure est réservée aux données synthétiques.

```bash
pnpm infra:up
pnpm db:migrate
pnpm test
```

MinIO, Mailpit, Redis et PostgreSQL sont exposés uniquement pour le développement local.
# Routage auto-hébergé

Le profil `routing` démarre OSRM et VROOM sans transmettre les adresses des patients à un service cartographique tiers.

Placez un extrait OpenStreetMap régional approuvé dans `infra/routing-data/region.osm.pbf`, puis préparez-le une seule fois :

```bash
docker run --rm -t -v "$(pwd)/infra/routing-data:/data" osrm/osrm-backend:v6.0.0 osrm-extract -p /opt/car.lua /data/region.osm.pbf
docker run --rm -t -v "$(pwd)/infra/routing-data:/data" osrm/osrm-backend:v6.0.0 osrm-partition /data/region.osrm
docker run --rm -t -v "$(pwd)/infra/routing-data:/data" osrm/osrm-backend:v6.0.0 osrm-customize /data/region.osrm
docker compose -f infra/docker-compose.yml --profile routing up -d osrm vroom
```

Ne placez jamais de données patient dans ce dossier. Les coordonnées restent en base chiffrée/HDS et sont envoyées uniquement aux services internes OSRM/VROOM.
