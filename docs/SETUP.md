# Setup, deployment and checks

[← Documentation index](../README.md)

## 💻 Local development

Use a supported Node.js version for the installed Vite release, npm, and PostgreSQL. A dedicated demo database is safest. From the repository root:

```powershell
npm install
Copy-Item .env.example .env
# Edit .env and set DATABASE_URL for the intended demo database.
npm run reset:demo
npm run dev
```

Open `http://localhost:5173`; Vite proxies `/api` to the Express API on `http://localhost:3001`. The root `.env` is loaded by the backend. The [configuration guide](CONFIGURATION.md) explains email settings and the frontend build flag.

| Command | Purpose |
|---|---|
| `npm run dev` | Start frontend and API watchers |
| `npm run build` | Type-check and build both workspaces |
| `npm run start:local` | Build and serve the app locally from one process |
| `npm run migrate` | Apply SQL migrations |
| `npm run reset:demo` | Migrate and reseed fictional demo projects |
| `npm test` | Run backend workflow tests |
| `npm run smoke` | Build and run compatibility smoke checks |
| `npm run check:vercel-entry` | Verify the serverless routing entry |

Some checks and tests change demo data. Reset after running the scripted [walkthrough](DEMO_GUIDE.md). Do not run a reset against a production database.

## ☁️ Vercel demo

[`vercel.json`](../vercel.json) builds `frontend/dist` and rewrites `/api/v1/*` and `/health` to [`api/index.ts`](../api/index.ts). Configure `DATABASE_URL` and the chosen [email variables](CONFIGURATION.md#email-delivery) in each Vercel project's environment settings. Set `PUBLIC_APP_URL` to that deployment's own URL so email buttons open the hosted task. Vercel does not read the root `.env` from your machine.

After deploying, migrate and seed the intended database once. Check `/health`, sign in, and run the hosted seed check. The two demo URLs currently share a demo database, so a reset affects both.

```powershell
$env:CVRDE_UI_URL='https://biztel-ai-cvrde.vercel.app'
node scripts/check-demo-seed-13.mjs
```

## 🏢 Offline LAN deployment

[`deploy/README-LAN.md`](../deploy/README-LAN.md) covers the Docker Compose, PostgreSQL 18 and Caddy stack, local certificate trust, and image transfer. Fonts, scripts and icons are bundled locally; the core app runs without internet. A LAN SMTP server is the email option when external Resend access is unavailable. Database backups and restores are described in [`deploy/restore.md`](../deploy/restore.md).

When using the root `.env` with Compose, pass it explicitly:

```powershell
docker compose --env-file .env -f deploy/docker-compose.yml up -d --build
```

Compose also needs `DOMAIN` and `POSTGRES_PASSWORD`; its API database URL points to its own PostgreSQL service. Check the LAN guide before moving images or seeding a LAN host.
