# CVRDE Work Management Demo

A fictional engine development programme showing how a PM structures work, assigns tasks, reviews evidence, signs off results, and follows up on meetings. **Use fictional data only:** the public demo accounts are not for real CVRDE or DRDO information.

[Open the live demo](https://biztel-ai-cvrde.vercel.app/)

## 📚 Documentation

| Guide | What it covers |
|---|---|
| [Project and features](docs/PROJECT.md) | Purpose, roles, permissions, screens, workflow, demo scope |
| [Technology and architecture](docs/TECH_STACK.md) | Stack, data model, security, storage, repository map |
| [Demo walkthrough](docs/DEMO_GUIDE.md) | Accounts, eight-step story, sample files, reset, verification |
| [Setup and deployment](docs/SETUP.md) | Local development, Vercel, Docker LAN, commands, checks |
| [Configuration](docs/CONFIGURATION.md) | Environment variables, Resend and SMTP, `VITE_DEMO_MODE` |

## 🚀 Quick start

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` for a **dedicated demo database**.
3. Run `npm run reset:demo` to migrate and seed the fictional programme.
4. Run `npm run dev`, then open `http://localhost:5173`.

On the sign-in screen, choose a demo person; the form fills their credentials. Read the [setup guide](docs/SETUP.md) before using an existing or hosted database: resetting replaces the named fictional demo projects.

> **Demo UI:** `VITE_DEMO_MODE` defaults to on. Set `VITE_DEMO_MODE=false` **before building the frontend** to show groups, linked tasks, prerequisites, and reassignment and due-date requests. See [configuration](docs/CONFIGURATION.md#demo-mode).

## 🧭 At a glance

```text
Project → Sub-project → Task → Evidence → Review → Sign-off
                            ↘ Meeting action → My work
```

The app uses React and TypeScript, an Express API, PostgreSQL, and a configurable email provider. In-app notifications and the audit trail record the work loop. The [technology guide](docs/TECH_STACK.md) has the full stack.
