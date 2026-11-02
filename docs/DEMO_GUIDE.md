# Demo walkthrough

[← Documentation index](../README.md)

## 👤 Demo accounts

Select a person on the sign-in page to fill the demo credentials. These accounts and their shared password are intentionally public and contain fictional data only.

| Person | Username | Story role |
|---|---|---|
| R. Sharma | `pm.demo` | PM |
| A. Iyer | `scientist1.demo` | Design & Simulation sub-project owner |
| K. Menon | `prototype.demo` | Prototype Build sub-project owner |
| P. Rao | `testing.demo` | Testing & Validation sub-project owner |
| S. Nair | `scientist2.demo` | Task owner |
| V. Kulkarni | `task2.demo` | Task owner |

The shared demo password is `CVRDE-Demo-2026!`. It fills automatically when you select a person.

## 🎬 Eight-step live story

| Step | Person | Action and expected result |
|---|---|---|
| 1 | R. Sharma | Open PM Overview; see the three sub-projects at different stages. |
| 2 | A. Iyer | Create **Valve train kinematics simulation** in Design & Simulation, set a due date, and assign S. Nair. |
| 3 | S. Nair | Start it, upload the [sample report](../frontend/public/demo-files/combustion-cfd-report.pdf), and submit the result. |
| 4 | A. Iyer | Return the submission with a reason. S. Nair sees the reason and a notification. |
| 5 | S. Nair | Upload the [revised report](../frontend/public/demo-files/revised-cfd-report.pdf) and resubmit. |
| 6 | A. Iyer | Sign off the result. Design & Simulation progress increases on PM Overview. |
| 7 | R. Sharma | Record a review meeting and assign an action item. |
| 8 | A. Iyer | Find the action item in My work and its assignment notification. |

Assignment, first submission, return, resubmission, sign-off, and meeting action each send one email when email is enabled. Comments and task start stay in-app only. The hosted six-message delivery check passed on 31 Oct 2026; see [email configuration](CONFIGURATION.md#email-delivery). A [sample drawing](../frontend/public/demo-files/piston-concept-drawing.png), [Prototype Build sample PDFs](../frontend/public/demo-assets), and [backup recording](../demo/recordings/cvrde-walkthrough.webm) are available. All sample files are dummy content.

## ♻️ Reset and automated checks

Use a dedicated demo database. `npm run reset:demo` runs migrations and restores the two named fictional demo projects and their accounts. It **replaces those demo projects**, so run it only against the intended database. It does not delete unrelated projects. Reset after a walkthrough.

```powershell
npm run reset:demo
node scripts/check-demo-seed-13.mjs
$env:CVRDE_UI_URL='https://biztel-ai-cvrde.vercel.app'
node scripts/check-demo-story-13.mjs
npm run reset:demo
```

The hosted walkthrough creates tasks, submissions and a meeting; it changes data. The hosted app and local reset command must point to the **same demo database**. The seed check is read-only. See the [setup guide](SETUP.md) for local and hosted environments.
