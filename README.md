# CVRDE work management demo

A fictional engine development programme for demonstrating project structure, task execution, evidence, review, sign-off, and meeting follow-up. No real CVRDE or DRDO information belongs in this demo database.

| Hosted app | Health check |
|---|---|
| [Primary demo](https://biztel-ai-cvrde.vercel.app/) | [API health](https://biztel-ai-cvrde.vercel.app/health) |
| [Second deployment](https://cvrde-five.vercel.app/) | [API health](https://cvrde-five.vercel.app/health) |

## Demo accounts

The shared password is `CVRDE-Demo-2026!`. Pick an account on the sign-in page to fill its credentials.

| Person | Username | Demo role |
|---|---|---|
| R. Sharma | `pm.demo` | PM |
| A. Iyer | `scientist1.demo` | Design & Simulation sub-project owner |
| K. Menon | `prototype.demo` | Prototype Build sub-project owner |
| P. Rao | `testing.demo` | Testing & Validation sub-project owner |
| S. Nair | `scientist2.demo` | Task owner |
| V. Kulkarni | `task2.demo` | Task owner |

The project switcher opens **Engine Development Programme**, a fictional 1.5 L petrol R&D programme. Its three sub-projects have deliberately different states: Design & Simulation has completed, submitted, returned, overdue, and open work; Prototype Build is underway; Testing & Validation is planned. Dates are relative to the day the seed runs. A past design review has two linked action tasks.

## Live walkthrough

1. R. Sharma opens the project and checks the three sub-projects on Overview.
2. A. Iyer creates **Valve train kinematics simulation** in Design & Simulation, assigns S. Nair, and sets a due date.
3. S. Nair starts the task, uploads [sample simulation report](frontend/public/demo-files/combustion-cfd-report.pdf), and submits a result.
4. A. Iyer returns it with a reason. S. Nair sees the notification and returned reason.
5. S. Nair uploads [revised report](frontend/public/demo-files/revised-cfd-report.pdf) and resubmits.
6. A. Iyer accepts the result. R. Sharma sees Design & Simulation progress increase.
7. R. Sharma records a review meeting and adds an action item.
8. A. Iyer sees the action item in My work and receives an assignment notification.

A [sample drawing](frontend/public/demo-files/piston-concept-drawing.png) is also provided. All files contain dummy content. A [backup walkthrough recording](demo/recordings/cvrde-walkthrough.webm) is available for the team.

## Reset and verification

Use a dedicated demo database. Set `DATABASE_URL` in the root `.env` (copy `.env.example`), then run from the repository root:

```powershell
npm install
npm run reset:demo
node scripts/check-demo-seed-13.mjs
```

`npm run reset:demo` applies migrations and restores the fictional programme and its accounts in one command. It replaces the two named demo projects only; it does not delete other projects. Run it after a live walkthrough to return to the starting state. To test a hosted deployment, set `CVRDE_UI_URL` to its origin before running the seed check or walkthrough check. The hosted app must use the same database that was seeded.

```powershell
$env:CVRDE_UI_URL='https://biztel-ai-cvrde.vercel.app'
node scripts/check-demo-seed-13.mjs
```

Other useful commands: `npm run dev` starts the web app and API, `npm run build` checks and builds both workspaces, `npm test` runs API workflow tests, and `npm run smoke` checks the older compatibility demo. The app uses React, Vite, Express, and PostgreSQL. Attachments are stored in PostgreSQL so downloads work across hosted instances.

## Deployment

[`vercel.json`](vercel.json) serves the frontend and routes `/api/v1/*` to [`api/index.ts`](api/index.ts). Configure `DATABASE_URL` on the hosting project, deploy, run migrations against that same database, then reset the demo. Check `/health`, sign in, and run the hosted seed and walkthrough checks. Both hosted URLs currently use the same demo database.

The [`deploy/`](deploy/) directory contains Docker/Caddy files for LAN hosting. Fonts, icons, and scripts are bundled locally.

### Email notifications

Email is a second channel for assignment, submission, return, sign-off, meeting action assignment, and task due date or owner changes. Comments stay in-app only. For the hosted demo, set `EMAIL_ENABLED=true`, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `RESEND_FROM` (a verified sender address). Set `PUBLIC_APP_URL` so links open the hosted task. Set `EMAIL_REDIRECT_TO` to the team inbox: the app keeps the intended recipient in its notification log while delivering all email to that inbox. Resend uses its [email API](https://resend.com/aws-lambda). `EMAIL_ENABLED=false` stops email and leaves in-app notifications active. Delivery errors are recorded as `FAILED` without reversing task work.

For a future internal SMTP server, use `EMAIL_PROVIDER=smtp` with `SMTP_HOST`, `SMTP_PORT`, and `SMTP_FROM`; set `SMTP_USER` and `SMTP_PASSWORD` if authentication is required.

The Docker API joins the outbound network for an SMTP server on the LAN. Do not add SMTP credentials to Git; configure these values in the deployment environment. The test sink in [`scripts/smtp-sink-17.mjs`](scripts/smtp-sink-17.mjs) captures fictional messages locally for verification.

The hosted demo keeps groups, reassignment and extension requests, prerequisites, and linked task controls out of the interface while retaining their data and API support. Set `VITE_DEMO_MODE=false` at frontend build time to show those controls. The approved scope and deferred items are recorded in [`docs/DEMO_BUILD_PLAN.md`](docs/DEMO_BUILD_PLAN.md).

## Repository map

| Path | Purpose |
|---|---|
| [`frontend/src/`](frontend/src/) | Screens and shared UI |
| [`backend/src/`](backend/src/) | API, permissions, seed, notifications |
| [`backend/migrations/`](backend/migrations/) | PostgreSQL schema |
| [`scripts/`](scripts/) | Reset, checks, sample-file generation |
| [`docs/`](docs/) | Acceptance and handover material |
