# Final demo screen audit

Checked against the eight screen content criteria in issue #20 on 3 Nov 2026: purpose, one occurrence per fact, state consistency, role permissions, useful empty states, plain language, consistent dates, and workflow order.

| Screen | Final check |
| --- | --- |
| My work | One owned-task table, ordered by action; returned reasons and completed dates are visible. No unrelated tasks or disabled actions. |
| My sub-project | One task table puts review items first; the header shows its objective, due date, and progress. The owner sees only their sub-project. |
| PM Overview | Project header, pending reviews, full-width at-risk table, then sub-projects. Meeting-action and milestone panels are hidden in the demo. |
| Tasks | Search and filters precede the sortable table. Assigned, due date, timing, owner, reviewer, and status are separate columns. |
| Review | Evidence and summary appear with each decision. Return requires a reason; Sign off is the primary action. |
| Meetings | Lists sort by meeting date. Detail distinguishes “Held” from “Minutes recorded” and shows the editor after a change. Action items link to tasks. |
| Settings | Members, Import, and At-risk rule are separate tabs. The member table uses “Sub-project owner” and “Task owner” in the demo. |
| Task detail | Owner, reviewer, and PM states follow the issue #20 matrix. Evidence, submissions, discussion, and collapsed history appear in workflow order. |

The [hosted screenshots](screenshots) were captured after deployment. Checks: `check-demo-seed-13.mjs`, `check-prototype-seed-22.mjs`, `check-home-screens-21.mjs`, `check-task-detail-ui-20.mjs`, `check-task-detail-api-20.mjs`, `check-role-scope-ui-19.mjs`, and `check-role-scope-19.mjs`. The hosted eight-step story passed with recording enabled, then the fictional project was reset to 23 tasks and 6 done.

The user asked to keep `TEAL_DEMO` and `BiztelAI_Work`. Demo accounts are scoped to Engine Development Programme; those two projects remain in the database. The project switcher remains visible for PMs at the user's later request.
