# Handover

## What is included

- React frontend and Express API implementing the F1–F9 demo flows and E1–E5 extensions in the plan.
- SQL migrations, expanded fictional seed data, PostgreSQL attachment storage, SMTP adapter, and one-project Vercel configuration.
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
| `api/index.ts` and `vercel.json` | Single Vercel project entry and routing |
| `deploy/` | Compose, HTTPS proxy, backup and restore instructions |

## Configuration

For Vercel, set `DATABASE_URL` in one project. For local development, copy the root `.env.example` to the root `.env`. The fictional demo password is public and stored in `backend/src/demo.ts`; run `npm run seed` after changing it. SMTP values and four controlled `DEMO_EMAIL_*` inboxes are optional for mail verification. Keep `.env` outside Git.

Neon holds the PostgreSQL database and attachment bytes. Back up the database. Existing disk attachments can be copied with `npm run backfill:files` after migration. The API needs outbound TLS access to Neon. An isolated CVRDE deployment must use local PostgreSQL instead.

## Run and verify

Follow the [root README](../README.md) for local or Vercel startup. Run migrations before deploying new code. Run `npm run seed` when the fictional demo project should be reset. The seed also updates the four demo passwords and configured inbox addresses. Run `npm run smoke` to check login, sample data, and downloads.

The [PowerPoint](CVRDE_Demo_Presentation.pptx) was refreshed on 25 October 2026 from the **local production frontend build** and validated by opening and rendering all eight slides in Microsoft PowerPoint. Re-run `npm run seed` before `node scripts/capture-demo.mjs`, then run `node scripts/create-deck.mjs`, and reset the demo afterward. The capture creates a pending reassignment for the reviewer slide. A second capture without a reset can conflict with that pending request.

## Current external dependencies

- No existing BiztelAI email implementation was present in the workspace. A configurable SMTP adapter is in place. Verify its integration or replace the adapter with the existing module before a customer demonstration.
- Neon was connected locally for migration and seeding. On 25 October 2026 the canonical Vercel deployment passed all four demo logins, task and report reads, attachment access, and the 4 MB upload limit. The older Vercel domain redirected to the canonical one. Commit `0c1bae7` deployed successfully, and seeded tasks and an attachment remained accessible afterward. Run `node scripts/verify-live.mjs` for a repeat check.
- SMTP delivery remains optional and unverified.
- Backup and isolated restore remain unverified against the current Neon PostgreSQL 18.6 instance: the installed `pg_dump` is version 17.10, and Docker Desktop was stopped during this check. Use PostgreSQL 18 client tools and a separate restore database.
- A pooled Neon connection intermittently returned an empty `search_path` after a failed `pg_dump` attempt. The direct, unpooled Neon hostname worked for local screenshot capture and reseeding. Investigate the pooler session state before treating local pooled checks as reliable.

## Suggested demo order

1. Reset demo data and confirm the overview has seventeen varied tasks.
2. As PM, open project groups and a submitted result; return or accept it.
3. As Scientist One, show own and shared tasks, then request a due-date extension or raise a pendency.
4. As PM, request reassignment of Fatigue test setup to Scientist Two.
5. As reviewer, approve the reassignment from Pending my action.
6. Return to PM dashboard and export both reports.
