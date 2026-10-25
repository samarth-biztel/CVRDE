# Acceptance and verification

Checked on **25 October 2026** against the revision 4 plan, the local production build, the Neon demo database, and [the deployed Vercel project](https://biztel-ai-cvrde.vercel.app/). The fictional demo project was reseeded after workflow tests and screenshot capture. The user's later deployment choice is one Vercel project with Neon, rather than the plan's VM and Caddy setup. The later upload limit is 4 MB.

## Evidence

| Check | Result | Evidence |
|---|---|---|
| Production build | Pass | `npm run build` compiled Express and Vite. Vite emitted dependency `use client` warnings, with a successful build. |
| Vercel function entry | Pass | `npm run check:vercel-entry` checked rewrites and missing database handling. |
| Database smoke | Pass | `npm run smoke` checked login, expanded seed, and PostgreSQL attachment download. |
| API workflow integration | Pass with test setup | The existing Vitest workflow passed after a seed reset and a temporary 240 second timeout. Its checked paths include access control, extension approval, reassignment approval, result return and resubmission, attachment type, CSV, pendency resolution, and group revocation. The test file was restored afterward. The original 60 second timeout had failed on a slow run. |
| Browser layout and interaction | Pass | `node scripts/visual-check.mjs` checked desktop and mobile login without scrolling, public demo fill during API outage, fixed/collapsible sidebar, command search, theme reveal origin, and test IDs. |
| Live HTTPS and accounts | Pass | `node scripts/verify-live.mjs` checked `/health`, public demo credentials, all four logins, 17 tasks, dashboard, two CSV reports, project documents, task and attachment access, 4 MB upload rejection, and the legacy domain redirect. |
| PowerPoint | Pass | [Eight slide deck](CVRDE_Demo_Presentation.pptx) regenerated from current browser captures. The PPTX ZIP is valid and Microsoft PowerPoint opened and rendered all eight slides. The reviewer slide shows a real pending reassignment. |

## Plan acceptance by workflow

| Plan area | Result | Remaining verification |
|---|---|---|
| Four roles and seeded demo | Verified locally and live | Four HTTPS logins and the 17 task seed pass. |
| PM creates projects, parent tasks, and tasks | Available; not independently exercised this round | Create a disposable project and tasks through the UI, then check member visibility. |
| Member status updates and comments | Available; not independently exercised this round | Check an owner update and a group comment in a disposable task. |
| Dashboard, overdue work, and reports | Verified locally and live | Seeded dashboard has 17 tasks and two overdue tasks; both CSV routes respond. |
| Due date extensions | Partly verified | Approval and date change pass in the integration test; rejection still needs a separate end to end check. |
| Reassignment | Partly verified | Reviewer approval and changed ownership pass; rejection still needs a separate end to end check. |
| Results and versioned files | Verified locally; read access verified live | Return, resubmit, accept, versioning, download, and unauthorized rejection were checked. |
| Groups, private tasks, and permissions | Verified locally and live | Group revocation passes locally; private task and attachment denial pass live. |
| Pendency and pending action queues | Partly verified | Seeded pendency resolution and queue removal pass; new raise/approve/reject paths need separate checks. |
| Task history and activity export | Partly verified | Events are written by the workflow test. History CSV and field diff completeness need a direct review. |
| Project documents and PLM placeholder | Partly verified | Seeded document listing passes live; earlier local version download passed. PLM remains a placeholder by plan. |
| Upload validation | Verified | Office file acceptance and mismatched PDF rejection pass locally; an oversized upload returns 413 live. |
| Email delivery | Pending external configuration | Root `.env` has `DATABASE_URL` only. Configure SMTP and four controlled inboxes, run `npm run test-email -w backend`, then observe assignment, status, reassignment, and pendency messages. |
| HTTPS from another device | Partly verified | HTTPS, health, and login pass from this machine. A second device/browser network check remains. |
| Deployment persistence | Pending redeploy observation | Compare a task and attachment before and after a fresh Vercel deployment. Current live reads confirm data is present. |
| Backup and isolated restore | Pending tooling | Neon reports PostgreSQL 18.6; installed `pg_dump` is 17.10 and refused the backup. Docker Desktop's daemon is stopped. Use a PostgreSQL 18 client and restore into a separate database; never restore over the live demo. |
| Docker Compose images | Previously verified | Images and API health passed in the earlier local check. A repeat build was unavailable while Docker Desktop was stopped. The active deployment is Vercel. |

## Reproduction

```sh
npm run build
npm run smoke
npm run check:vercel-entry
npm test
node scripts/verify-live.mjs
node scripts/visual-check.mjs
node scripts/capture-demo.mjs
node scripts/create-deck.mjs
```

`npm test` and `capture-demo.mjs` change fictional demo records. Run `npm run seed` before and after them. Capture the deck only after the production build is served at `http://localhost:5173`. For local verification, use a direct Neon connection if a pooled session has an empty PostgreSQL `search_path`.
