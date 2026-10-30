# Offline LAN deployment

The Compose stack runs the web app, API, PostgreSQL 18, and Caddy on the LAN. The frontend has no remote font, script, or icon requests. Caddy issues a local certificate and does not contact a public certificate authority.

1. On a build machine with the required npm packages and container images available, build the stack: `docker compose --env-file deploy/.env -f deploy/docker-compose.yml build`.
2. Copy the repository, built images, and a `deploy/.env` based on `.env.example` to the LAN host. Use a URL-safe `POSTGRES_PASSWORD` because Compose inserts it into the PostgreSQL URL.
3. Add the LAN host name from `DOMAIN` to local DNS or the clients' hosts files.
4. Start with `docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d`. The API applies migrations on startup. Seed a fresh demo database once with `docker compose --env-file deploy/.env -f deploy/docker-compose.yml exec api node dist/seed.js`.
5. Trust Caddy's local root certificate on client devices. It is stored in the `caddy_data` volume.

PostgreSQL data persists in `postgres_data`; attachments persist in the database. Runtime traffic remains within the stack and LAN. Backup and restore instructions are in `restore.md`.
