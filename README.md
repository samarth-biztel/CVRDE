# CVRDE Work Management Demo

Pilot application for task workflows below the Project Manager level. Uses fictional data only.

## Stack

React, TypeScript, Vite, TanStack Query; Node.js, Express, Zod, Kysely; Neon PostgreSQL; Docker Compose and Caddy. The database is external to Compose. Uploads live on a persistent Docker volume.

## Local start

1. Create a Neon PostgreSQL database, or use a local PostgreSQL database for development.
2. Copy `backend/.env.example` to `backend/.env`, fill `DATABASE_URL` and a unique `DEMO_PASSWORD` of at least 12 characters. For local HTTP, leave `COOKIE_SECURE=false`.
3. Run `npm install`, `npm run migrate`, and `npm run seed` from the repository root.
4. In separate terminals run `npm run dev -w backend` and `npm run dev -w frontend`. Open `http://localhost:5173`.

Demo usernames: `pm.demo`, `scientist1.demo`, `scientist2.demo`, `reviewer.demo`. All use `DEMO_PASSWORD` after the reset. The reset deletes and rebuilds the named demo project; it does not delete unrelated projects.
To verify notifications, set `DEMO_EMAIL_PM`, `DEMO_EMAIL_S1`, `DEMO_EMAIL_S2`, and `DEMO_EMAIL_REVIEWER` to four controlled test inboxes before seeding.

## Cloud deployment

Copy `.env.example` to `.env` in the root and supply `DOMAIN`, `DATABASE_URL`, `DEMO_PASSWORD`, and SMTP settings. Point DNS at the VM and allow inbound 80/443. Run:

```sh
docker compose --env-file .env -f deploy/docker-compose.yml build
docker compose --env-file .env -f deploy/docker-compose.yml run --rm api node dist/migrate.js
docker compose --env-file .env -f deploy/docker-compose.yml run --rm api node dist/seed.js
docker compose --env-file .env -f deploy/docker-compose.yml up -d
```

Caddy obtains a public certificate. The API and database have no public inbound port on the VM. The API needs outbound TLS access to Neon. Uploaded files are served only through authorized API endpoints.

## Operations

- Restart: `docker compose --env-file .env -f deploy/docker-compose.yml restart`.
- Reset demo data: `docker compose --env-file .env -f deploy/docker-compose.yml run --rm api node dist/seed.js`.
- Backup: `sh deploy/backup.sh`; see [restore steps](deploy/restore.md).
- Email attempts are recorded in `notification_log`. If `SMTP_HOST` is empty, delivery is marked `SKIPPED`; task changes still succeed.
- A later isolated CVRDE deployment needs local PostgreSQL in place of Neon and a certificate from CVRDE IT.

## Current limits

The supplied workspace did not include the existing email implementation or deployment credentials. The app has a configurable SMTP adapter and no live deployment has been made. Do not use the fictional demo accounts or seed data for production.
