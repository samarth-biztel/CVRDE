# Configuration

[← Documentation index](../README.md)

Copy [`.env.example`](../.env.example) to a root `.env` for local API development. Keep `.env`, database URLs, and mail credentials out of Git. Configure hosted values in the deployment's secret environment settings.

## ⚙️ Environment variables

| Variable | What it controls | Example / note |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection for the API, migrations, seed and files | Point to a dedicated demo database |
| `EMAIL_ENABLED` | Whether eligible events attempt email | `true` or `false`; bell still works when false |
| `EMAIL_PROVIDER` | Delivery adapter | `resend` for hosted demo, `smtp` for a mail server |
| `EMAIL_REDIRECT_TO` | Sends all demo email to one team inbox | Leave empty to deliver to real user addresses |
| `PUBLIC_APP_URL` | Base for task buttons inside email | Use the exact deployed origin, without a path |
| `RESEND_API_KEY` | Resend API authentication | Secret; required with `EMAIL_PROVIDER=resend` |
| `RESEND_FROM` | Verified sender for Resend | Required with `EMAIL_PROVIDER=resend` |
| `SMTP_HOST` / `SMTP_PORT` | SMTP server and port | Port `587` by default; `465` uses implicit TLS |
| `SMTP_USER` / `SMTP_PASSWORD` | SMTP authentication | Needed only if the server requires login |
| `SMTP_FROM` | Sender for SMTP | Replace the `example.invalid` placeholder |
| `VITE_DEMO_MODE` | Frontend demo-only visibility switch | Defaults to on; set `false` at frontend build time |

`APP_ORIGIN`, `PORT`, and `COOKIE_SECURE` are optional API settings for a custom local or LAN deployment. Docker Compose additionally requires `DOMAIN` and `POSTGRES_PASSWORD`. See the [LAN guide](../deploy/README-LAN.md).

## 🎭 Demo mode

The code treats **any value other than the exact string `false` as demo mode on**. In the default build, the UI hides groups, linked-task controls, prerequisites, and reassignment and due-date extension requests. Their tables and API endpoints remain. API permission checks still apply. This follows [Issue #18](https://github.com/biztel-engg/ProjMgmtSoftware/issues/18) and the [approved plan](DEMO_BUILD_PLAN.md).

To show the controls locally in PowerShell, set the variable **before starting or building Vite**:

```powershell
$env:VITE_DEMO_MODE='false'
npm run build -w frontend
```

For `npm run dev`, set the variable before starting the process. For Vercel, add `VITE_DEMO_MODE=false` to the **frontend build environment**, then redeploy. The root `.env` is loaded by the backend; Vite runs in `frontend/`, so putting this flag only in the root `.env` does not configure the frontend build. `frontend/.env.local` is another local option. This flag only changes visible controls; it does not remove server routes or change permissions.

## ✉️ Email delivery

The hosted demo uses Resend: set `EMAIL_ENABLED=true`, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `RESEND_FROM`, `EMAIL_REDIRECT_TO`, and `PUBLIC_APP_URL`. A verified sender domain is required. The redirect keeps demo mail in one inbox while the notification log retains the intended user. The hosted six-event walkthrough was verified as `SENT` in the app and `delivered` by Resend on 31 Oct 2026. The [email preview](email-preview.png) shows the returned-task message.

For a future internal SMTP service, set `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, and `SMTP_FROM`; add `SMTP_USER` and `SMTP_PASSWORD` if required. SMTP is provided for the LAN path, while Resend needs internet access. Only assignment, submission, return, sign-off, meeting action, and task owner or due-date changes are email-enabled. Comments stay in-app only. A provider failure records `FAILED` but does not roll back the task action; disabled email records `SKIPPED`.

If local Docker email buttons should open the hosted demo, set `PUBLIC_APP_URL` to the hosted origin rather than `localhost`. Pass the root file with `docker compose --env-file .env -f deploy/docker-compose.yml ...`; Vercel needs its own environment settings.
