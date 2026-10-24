# CVRDE Work Management Demo

Fictional pilot for project, task, review, pendency, and reporting workflows. The frontend is React/Vite, the API is Node.js/Express, and the database is Neon PostgreSQL.

## Local start

1. Copy `.env.example` to `.env` in the repository root. Set `DATABASE_URL` to your Neon connection string.
2. From the repository root, run:

```powershell
npm install
npm run migrate
npm run seed
```

3. Start the frontend and backend together, with live reload. Press Ctrl+C to stop both:

```powershell
npm run dev
```

Open `http://localhost:5173`. Demo accounts are `pm.demo`, `scientist1.demo`, `scientist2.demo`, and `reviewer.demo`. Their public password is `CVRDE-Demo-2026!`, shown on the login page. Seeding resets only the named fictional demo project and updates the four demo users.

## One Vercel project

Import this repository as **one** Vercel project with the repository root as Root Directory. The root `vercel.json` builds `frontend/dist`, serves it as the site, and routes `/api/v1/*` to one Express function. No separate backend project, frontend project, or public API URL is needed.

Set these environment variables in the Vercel project:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |

Before the first deployment, run `npm run migrate` and `npm run seed` locally against that Neon database. After schema changes, run migrations again before deploying the new code. Seeding is a deliberate reset of the demo project, so run it only when you want the sample data refreshed. The API uses secure cookies automatically on Vercel.

For existing installations with files in `backend/uploads`, run `npm run backfill:files` after migration and before deployment. This copies old attachment bytes into PostgreSQL. New uploads are stored in PostgreSQL and work across Vercel function instances. Uploads are limited to 4 MB to fit Vercel's request size limit.

The shared demo password is deliberately public. Use this app only with the fictional demo database. The seeded accounts can edit that demo data. Do not reuse the demo password for another service.

### Demo login on deployed URLs

The demo account names and password are built into the fictional pilot and remain visible even if the API is temporarily unavailable. For both `https://cvrde-five.vercel.app` and `https://biztel-ai-cvrde.vercel.app`, open `/health` after deployment. A `500` or `FUNCTION_INVOCATION_FAILED` means the API has failed to start; check the function logs and `DATABASE_URL`. The frontend can show the password, but sign in still requires a working API and a database seeded with the same password.

The local root `.env` is ignored by Git and is not sent to Vercel. Add `DATABASE_URL` in each Vercel project's **Settings → Environment Variables** for the environment that serves its URL. If both domains point to one project, configure that project once. Redeploy after changing variables, because older deployments keep their previous values. Run `npm run seed` again to set the public password on existing demo accounts.

## Optional email

Notifications are logged even when email is not configured. To send email, additionally set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. To deliver demo notifications to controlled inboxes, set `DEMO_EMAIL_PM`, `DEMO_EMAIL_S1`, `DEMO_EMAIL_S2`, and `DEMO_EMAIL_REVIEWER` before seeding.

The older Docker/Caddy setup remains under `deploy/` for self hosted use. Vercel deployment does not use Docker or Caddy.
