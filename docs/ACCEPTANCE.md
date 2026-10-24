# Acceptance checklist

This checklist follows the revision 4 plan. The earlier workflow tests ran against temporary PostgreSQL 17. The Vercel adaptation was checked against Neon with the smoke script and browser build; the public Vercel deployment still needs verification.

| Check | Status | Evidence or next check |
|---|---|---|
| Four fictional accounts log in with PM, member, and reviewer roles | Verified locally | API integration test and browser screenshots |
| PM creates projects, tasks, and parent tasks | Implemented | Create forms and API; task creation exercised through seed and screens |
| Members update status and comments | Implemented | API enforces owner and group permissions |
| Live dashboard matches task data | Verified locally | Expanded seed produced 17 tasks; browser showed matching totals |
| Due-date extension approval changes date; rejection does not | Partially verified | Approval and date change tested; rejection path implemented |
| Reassignment reviewer approval and rejection | Partially verified | Approval and owner change tested; rejection path implemented |
| Results submitted, returned, resubmitted, accepted | Verified locally | API test exercised versions 2 to 3 and state transitions |
| Attachment versions download only for authorized users | Verified locally | Earlier API test checked group access and revocation; new smoke check downloaded a PostgreSQL stored document |
| Task history and activity feed | Implemented | Browser screens and audit writes; event filter and CSV available |
| Groups with membership and permissions | Verified locally | Access revoked immediately after removal in API test |
| Pendency raised, approved, resolved | Partially verified | Seeded open pendency resolved in API test; approval path implemented |
| Pending my action | Verified locally | PM and reviewer browser screenshots; queue disappearance tested |
| Two filtered reports and CSV | Verified locally | Browser screenshot and API CSV check |
| Project documents and version downloads | Verified locally | Two seeded document versions listed and accessible |
| URL and request tampering rejected | Verified locally | Cross-user 403/404 checks in API test |
| Upload type, size, and authorized download | Partially verified | Valid Office file and mismatched PDF rejected/accepted as expected; size limit is configured but not separately load-tested |
| Assignment, reassignment, status, and pendency emails | Needs SMTP | Configure four test inboxes, run `npm run test-email -w backend`, then exercise each event |
| HTTPS from a separate device | Needs Vercel deployment | Import the repository as one Vercel project and verify its generated HTTPS URL |
| Docker Compose images build | Verified locally | API and web production images built; API container returned `{"ok":true}` from `/health` |
| Restart keeps database and uploads | Needs Vercel deployment | Redeploy and check Neon task data plus attachment download |
| Backup and restore | Earlier local check only | Earlier `pg_dump`/`pg_restore` matched the original seed; Neon now also stores attachment bytes |
| PowerPoint screenshots match the running app | Needs refresh | Current [browser captures](screenshots/) show the Swiss high contrast theme; the PowerPoint deck predates it |

## Local verification commands

```sh
npm run build
npm run migrate
npm run seed
npm run smoke
npm run check:vercel-entry
```

The local test uses `DATABASE_URL` and the public demo password in the repository. The test changes demo data; run `npm run seed` again afterward.
