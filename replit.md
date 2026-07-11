# Gestão de Autônomos

A business management web app for independent service providers (freelancers, small studios, tradespeople) to send quotes, schedule tasks, and manage clients/products with their team.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, mounted at `/api`)
- `pnpm --filter @workspace/web run dev` — run the frontend (port 22333, mounted at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec (run after editing `lib/api-spec/openapi.yaml`)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` (all provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, mounted at `/api` as a separate artifact from the frontend
- Frontend: React + Vite + wouter + TanStack Query + shadcn/Tailwind v4
- Auth: Replit-managed Clerk (`@clerk/express`, `@clerk/react`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) → `lib/api-zod`, `lib/api-client-react`
- Build: esbuild (API, CJS bundle)

## Where things live

- API contract: `lib/api-spec/openapi.yaml` (source of truth — edit this, then run codegen)
- DB schema: `lib/db/src/schema/*.ts` (teams, users, clients, products, quotes + quote_items, tasks)
- API routes: `artifacts/api-server/src/routes/*.ts`
- Auth/team middleware: `artifacts/api-server/src/middlewares/auth.ts` (`requireAuth` JIT-provisions the local `users` row from Clerk; `requireTeam` gates team-scoped routes)
- Frontend pages: `artifacts/web/src/pages/{dashboard,quotes,tasks,clients,products,team,onboarding}`
- Frontend shell/nav: `artifacts/web/src/components/layout/Shell.tsx`
- Theme: `artifacts/web/src/index.css` (orange/navy palette, Plus Jakarta Sans + Space Mono)

## Architecture decisions

- Clerk has no organizations/tenant concept today, so "team" is a custom concept in our own DB: a `teams` table (with a generated invite code) plus a `users` bridge table keyed by the Clerk user id, holding `teamId` + `role`. All business data (clients, products, quotes, tasks) is scoped by `teamId`.
- New users land in an in-app onboarding screen (not a separate route) when `GET /me` returns `teamId: null` — they must create or join a team before reaching the dashboard/nav.
- Notifications are in-app only (an endpoint returning overdue/due-soon tasks, polled client-side) — no push/browser notification infra.
- The API server and frontend are separate artifacts on the same origin; the frontend calls a hardcoded `/api` base path (set in `lib/api-spec/orval.config.ts`), which the platform's path-based routing resolves to the API server artifact.

## Product

- **Dashboard**: pending quotes count/total, upcoming tasks, recent quotes, client/product counts.
- **Orçamentos (Quotes)**: create/edit with line items (freeform or from the product catalog), status workflow (draft/sent/approved/rejected), printable detail view.
- **Tarefas (Tasks)**: due-date scheduling, status toggle, in-app overdue/due-soon reminders.
- **Clientes (Clients)**: registry with search, per-client quote/task history.
- **Produtos (Products)**: service/product catalog used to prefill quote line items.
- **Equipe (Team)**: invite code sharing, member list; multiple users from the same business share all of the above.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, always re-run codegen before touching frontend/backend code that depends on the new shapes.
- Deep-importing `@workspace/api-client-react/src/generated/...` fails (the package's `exports` map only allows the `.` entry) — import types and hooks from `@workspace/api-client-react` directly.
- Orval query hooks require passing `queryKey` explicitly whenever you pass other `query` options (e.g. `enabled`, `refetchInterval`) — see `.local/skills/react-vite/references/frontend-general-rules.md`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
