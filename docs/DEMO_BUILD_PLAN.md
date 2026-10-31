# CVRDE fictional demo build plan — approved revision

This revision records the decisions in [Issue #18](https://github.com/biztel-engg/ProjMgmtSoftware/issues/18). The fictional Engine Development Programme has three sub-projects. The live loop is: PM overview, sub-project owner assignment, task owner evidence and submission, return with reason, correction and resubmission, sub-project owner sign-off, PM meeting and action item, then action item in its owner's My work and bell.

## Roles and permissions

The PM alone creates or edits a sub-project's name, Objective, due date, and owner. The Objective field explains “What this sub-project must deliver.” A sub-project owner creates, edits, and assigns its tasks, reviews submissions, and runs its meetings. Anyone who can view a task can comment, including another task owner in that sub-project. The API enforces these rules.

## Demo presentation

The single project switcher is optional for the demo. The real organisation name appears once in the sidebar. Task history uses readable sentences, and due dates use a common date format with relative labels. The demo interface hides groups, reassignment and extension requests, prerequisites, and “Linked to”; their schema and APIs stay intact. `VITE_DEMO_MODE=false` at frontend build time restores these controls.

The at-risk panel includes overdue open tasks, tasks due within three days that have not started, tasks with no update beyond the configured threshold, and explicit risk flags. The stale rule excludes Done and Submitted. An overdue Submitted task reads “Overdue, awaiting review.” The reset seed supplies Crankshaft stress analysis (overdue), Friction loss estimation (due in two days and not started), and Cooling jacket design (stale). My work groups Due this week as today through six days ahead, then Later.

## Phases and checks

1. Project hierarchy and scoped task permissions. Verify PM edits succeed and sub-project owner edits return 403.
2. Task evidence, return, resubmission, sign-off, comments, and readable history.
3. Meeting minutes and action items; verify the assigned action appears in My work and the bell.
4. Notifications through the existing `notify()` path and `notification_log`, after commit. Bell and email share assignment, submission, return, resubmission, sign-off, and meeting action assignment events. Redirect demo email to one team inbox. The scripted hosted walkthrough checks the eight UI steps; the six email deliveries require live Resend credentials and a verified sender.
5. Seed, hosted walkthrough recording, and cloud regression checks. Reset the fictional project after every walkthrough.

The email channel is implemented with Resend support. On 31 Oct 2026, the local Docker eight-step story produced six `SENT` notification-log records; Resend reported all six `delivered` to the configured team inbox. Hosted delivery verification is pending `EMAIL_ENABLED=true`, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `RESEND_FROM`, `EMAIL_REDIRECT_TO`, and `PUBLIC_APP_URL` in each Vercel project's environment settings. No key belongs in Git.

## Known gaps and roadmap

- PM My work: no PM-owned tasks in the fictional seed. The general My work and My submissions screens exist, but the demo uses Submitted in My work for its loop.
- Files currently live in PostgreSQL; move them to object storage for a future on-premise deployment.
- Roadmap: milestone planning, minutes approval, TRL tracking, multi-level review, and on-premise deployment. These are not claims about the current demo.
