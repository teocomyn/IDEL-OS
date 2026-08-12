# ADR-004 — Chiffrement applicatif

- Statut : accepté
- Date : 12 août 2026

Les champs suffixés `_enc` sont chiffrés en AES-256-GCM. Une clé de données par organisation
est dérivée par HKDF-SHA-256 à partir d’une clé maître fournie par un `KeyProvider`. Le format
stocke sa version, l’identifiant de clé, le nonce, le ciphertext et le tag d’authentification.

En production, la clé maître vient d’un KMS ou Vault situé dans le périmètre HDS. La clé locale
n’est utilisable qu’avec des données synthétiques. Les champs géographiques nécessaires aux
index (`postal_code`, `city`, `geo`) ne sont pas chiffrés ; ce compromis doit être couvert par
les contrôles d’accès, la RLS et la minimisation des logs.
