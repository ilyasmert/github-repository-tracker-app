# Repository Tracker

Small full-stack app for tracking GitHub repositories.

- **Backend:** Go 1.22, Gin, Ent, PostgreSQL
- **Frontend:** Next.js (App Router), TypeScript strict, TailwindCSS

This commit contains the project scaffold only — no business logic yet.

## Layout

```
.
├── backend/        Go service (cmd/server, internal/*)
├── frontend/       Next.js app (app/, lib/, components/)
├── docker-compose.yml
└── Makefile
```

## Quickstart (Docker)

```sh
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
make up
```

- Backend → http://localhost:8080 (health: `/healthz`)
- Frontend → http://localhost:3000
- Postgres → `localhost:5432` (user/pass/db all `tracker`)

## Quickstart (local, without Docker)

Requires Go 1.22+, Node 20+, and a running Postgres reachable via `DATABASE_URL`.

```sh
# terminal 1 — backend
cd backend && go mod tidy && go run ./cmd/server

# terminal 2 — frontend
cd frontend && npm install && npm run dev
```

## Environment

- **Backend** (`backend/.env.example`): `PORT`, `DATABASE_URL`, `GITHUB_TOKEN`, `GITHUB_BASE_URL`, `CORS_ORIGIN`.
- **Frontend** (`frontend/.env.example`): `NEXT_PUBLIC_API_BASE_URL`.

`GITHUB_TOKEN` is optional — unauthenticated requests are fine for low volumes but are subject to a stricter rate limit.

## Make targets

| Target | Purpose |
|---|---|
| `make up` / `make down` | Compose lifecycle |
| `make backend` | Run the Go server locally |
| `make frontend` | Run Next.js dev server |
| `make tidy` | `go mod tidy` |
| `make generate` | Run Ent code generation (once schemas exist) |
| `make test` | `go test ./...` |
| `make lint` | `go vet` + `next lint` |

## Migrations

For dev convenience, Ent schema creation runs on backend startup. For production we'd switch to versioned migrations via Atlas (`atlas migrate diff`).

## Status

Scaffold only. Endpoints, schema, and UI components arrive in follow-up commits per the architecture plan.