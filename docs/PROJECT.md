# Project and features

[← Documentation index](../README.md)

## 🎯 Purpose

CVRDE Work Management is a fictional, cloud-hosted demo of an engine development programme. It shows a complete work loop, from planning through evidence-based sign-off and meeting follow-up. The sample project is **Engine Development Programme**, a fictional 1.5 L petrol R&D programme. Seed dates are calculated relative to the day the seed runs.

| Level | Demo example | Responsibility |
|---|---|---|
| Project | Engine Development Programme | PM owns the project and its overview |
| Sub-project | Design & Simulation | Sub-project owner manages tasks and reviews results |
| Task | Valve train kinematics simulation | Task owner performs work and submits evidence |

**Prototype Build** is partly underway; **Testing & Validation** is planned. Design & Simulation includes open, overdue, submitted, returned, and completed work.

## 👥 Roles and access

| Role | Main responsibilities |
|---|---|
| PM | Create and edit projects and sub-project details; see risk, workload, progress, reports and settings; manage members; review work in their scope |
| Sub-project owner | Create, edit and assign tasks in their sub-project; review submissions; run its meetings; cannot edit sub-project details |
| Task owner | See My work, start tasks, update progress with a reason, upload evidence, submit or resubmit results, and comment |
| Shared viewer | View and comment on accessible tasks; cannot change status, upload, or submit another person's work |
| Admin | Account oversight and deactivation |

The API enforces permissions independently of the UI. Same-sub-project task owners can comment on work they can view. Review is shown only to people with review rights.

## 🗂️ Screens and workflows

| Area | What it shows or does |
|---|---|
| PM Overview | Waiting decisions, overdue and due-soon work, stale or flagged risks, workload, sub-project progress, recent activity |
| My work | Returned work and reasons, open tasks grouped by due date, submitted work awaiting review, activity |
| Projects | Project details, sub-projects, milestones, meetings, team, documents, and read-only project information for users |
| Tasks | Search, sort, filters, tabs, quick-add and inline actions for authorized users |
| Task detail | Description, deliverables, subtasks, justified progress, activity, files, submission and review outcome |
| Review | Submission decisions with reasons; requests are available outside demo mode |
| My submissions | Submitted work and request outcomes with reviewer comments |
| Settings | Members, account creation, Excel import, group permissions outside demo mode |
| Reports | PM reporting view |

Tasks use **Not started → In progress → Submitted → Done**, with **Returned** leading to revision and resubmission. A submission requires an attached file. The reviewer accepts or returns it with a reason. Meeting action items become tasks in the assignee's My work.

The app has a project switcher, role-based sidebar, action badges, search shortcut (`Ctrl K` or `⌘K`), consistent due-date labels, local fonts and icons, file drop zones, and a merged task activity history. The audit log records changes with actor and time.

## 🔔 Notifications

The bell records task assignments, submissions, returns, acceptances, comments, and request answers. Email is a second channel for assignments, submissions, returns, sign-offs, meeting actions, and due-date or owner changes. Comments stay in-app only. For the demo, outgoing mail can be redirected to one team inbox; an email failure is logged without reversing the task action. See [configuration](CONFIGURATION.md#email-delivery).

## 🧪 Demo scope and boundaries

The default demo build hides groups, reassignment and extension requests, prerequisites, and the “Linked to” task control. Their schema and APIs remain, and `VITE_DEMO_MODE=false` restores the controls at build time. This follows the approved [demo plan](DEMO_BUILD_PLAN.md). Attachments currently live in PostgreSQL; object storage is a future option. All demo accounts and sample files are fictional.

For the scripted sequence, start with the [demo guide](DEMO_GUIDE.md).
