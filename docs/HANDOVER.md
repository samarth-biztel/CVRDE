# Handover

## What is included

- React frontend and Express API implementing the F1–F9 demo flows and E1–E5 extensions in the plan.
- SQL migration, resettable fictional seed data, persistent attachment storage, SMTP adapter, Docker Compose and Caddy configuration.
- [Acceptance checklist](ACCEPTANCE.md), [8-slide presentation](CVRDE_Demo_Presentation.pptx), and real [browser screenshots](screenshots/).

## Repository map

| Path | Purpose |
|---|---|
| `backend/src/routes.ts` | Task, project, approval, pendency, dashboard, report routes |
| `backend/src/core.ts` | Session, role, task access, audit, notification helpers |
| `backend/src/files.ts` | Upload, version listing, authorized download |
| `backend/migrations/` | PostgreSQL schema |
| `backend/src/seed.ts` | Fictional reset data and sample files |
| `frontend/src/App.tsx` | PM, member, and reviewer screens |
| `deploy/` | Compose, HTTPS proxy, backup and restore instructions |

## Configuration

Copy `.env.example` for deployment or `backend/.env.example` for local development. Required values are `DATABASE_URL`, `DEMO_PASSWORD`, and, for public HTTPS, `DOMAIN`. SMTP values and four controlled `DEMO_EMAIL_*` inboxes are required to verify mail. Keep every `.env` outside Git.

Neon holds only the PostgreSQL database. Task and project files remain in the API uploads volume. Both must be backed up together. The API needs outbound TLS access to Neon. An isolated CVRDE deployment must use local PostgreSQL instead.

## Run and verify

Follow the [root README](../README.md) for local or cloud startup. After every migration, run `npm run build`, `npm run seed`, and `npm test` against a disposable demo database. The seed resets only the named fictional demo project. It also updates the four demo passwords and configured inbox addresses.

The PowerPoint was generated from screenshots of the **local production frontend build**, not a deployed cloud URL. Re-run `node scripts/capture-demo.mjs` and `node scripts/create-deck.mjs` after UI changes. The capture script creates a pending reassignment for the reviewer slide, so reset the demo afterward.

## Current external dependencies

- No existing BiztelAI email implementation was present in the workspace. A configurable SMTP adapter is in place. Verify its integration or replace the adapter with the existing module before a customer demonstration.
- No Neon project, VM, domain, SMTP account, or test inbox credentials were provided. The cloud URL, HTTPS access, email delivery, and restart procedures remain to be exercised in that environment.
- Compose syntax and both production images were built locally. The containers still need a live Neon connection and VM deployment check.

## Suggested demo order

1. Reset demo data and confirm the overview has six tasks and one overdue item.
2. As PM, open project groups and a submitted result; return or accept it.
3. As Scientist One, show own and shared tasks, then request a due-date extension or raise a pendency.
4. As PM, request reassignment of Fatigue test setup to Scientist Two.
5. As reviewer, approve the reassignment from Pending my action.
6. Return to PM dashboard and export both reports.
