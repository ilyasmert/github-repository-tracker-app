# Repository Tracker

A small full-stack app for maintaining a watchlist of GitHub repositories. Add a repo by `owner/name`, see its stars/language/description pulled from the GitHub API, attach notes, refresh on demand, and filter/sort the list. A stats panel summarises the collection.

- **Backend:** Go 1.25, Gin, Ent, PostgreSQL
- **Frontend:** Next.js 14 (App Router), TypeScript strict, TailwindCSS, TanStack Query

## Architecture

Strict one-directional layering on the backend; thin typed API layer on the frontend; React Query owns server state.

```
Browser ──HTTP──▶ Gin handlers ──▶ repos.Service ──▶ Ent repository ──▶ Postgres
                                         │
                                         └──▶ github.Client ──▶ api.github.com
```

The service is the only layer that knows business rules (`Create = validate + fetch GitHub + persist`, `Refresh = load + fetch + update`). Handlers parse and render; repositories run Ent queries; the GitHub client normalises upstream responses and errors. Full design notes live in [ARCHITECTURE.md](ARCHITECTURE.md).

## Backend structure

```
backend/
├── cmd/server/main.go                     # entrypoint: config, DB, migrate, wire, serve
├── internal/
│   ├── config/                            # env-driven config
│   ├── github/                            # typed GitHub client (404/rate-limit aware)
│   ├── repos/                             # domain: service, repository, errors
│   │   ├── service.go                     # orchestration + validation
│   │   ├── repository.go                  # Ent queries only
│   │   └── domain_errors.go               # ErrNotFound/Duplicate/GitHubNotFound/…
│   └── httpapi/
│       ├── router.go                      # Gin router + CORS + /healthz
│       ├── apierror/                      # domain → HTTP status/JSON envelope
│       ├── dto/                           # request/response shapes
│       └── handlers/repos.go              # thin HTTP handlers
└── ent/                                   # generated Ent code + schema/trackedrepo.go
```

## Frontend structure

```
frontend/
├── app/
│   ├── layout.tsx, page.tsx, providers.tsx  # RSC shell + QueryClientProvider
│   └── globals.css
├── components/
│   ├── StatsPanel.tsx, AddRepoForm.tsx
│   ├── FiltersBar.tsx, RepoList.tsx, RepoRow.tsx
│   └── ConfirmDialog.tsx
└── lib/
    ├── api/{client.ts, repos.ts, types.ts}  # typed fetch wrapper + endpoint fns + shared types
    ├── hooks/                               # React Query hooks (one per endpoint)
    └── url/                                 # search-param helpers for filters/sort
```

## Setup

### Docker (recommended)

```sh
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Optional: export GITHUB_TOKEN=ghp_... before `make up` to raise the GitHub rate limit.
make up
```

- Frontend → http://localhost:3000
- Backend  → http://localhost:8080 (health: `/healthz`)
- Postgres → `localhost:5432` (user/pass/db all `tracker`)

### Local (without Docker)

Requires Go 1.25+, Node 20+, and a Postgres reachable via `DATABASE_URL`.

```sh
# terminal 1 — backend
cd backend && go mod tidy && go run ./cmd/server

# terminal 2 — frontend
cd frontend && npm install && npm run dev
```

## Docker workflow

`docker-compose.yml` defines three services:

| Service    | Image / build         | Notes                                                  |
|------------|-----------------------|--------------------------------------------------------|
| `db`       | `postgres:16-alpine`  | Healthcheck (`pg_isready`); named volume `pgdata`.     |
| `backend`  | `backend/Dockerfile`  | Multi-stage Go build; waits for `db` to be healthy.    |
| `frontend` | `frontend/Dockerfile` | `next dev` on `:3000`; depends on `backend`.           |

Make targets:

| Target                | Purpose                                  |
|-----------------------|------------------------------------------|
| `make up` / `make down` | Compose lifecycle (`up --build` / `down`) |
| `make logs` / `make ps` | Stream logs / list services            |
| `make backend`        | `go run ./cmd/server`                    |
| `make frontend`       | `npm run dev`                            |
| `make generate`       | Run Ent code generation                  |
| `make test`           | `go test ./...`                          |
| `make lint`           | `go vet ./...` + `next lint`             |
| `make clean`          | `docker compose down -v` (drops volume)  |

Schema is applied on backend startup via Ent's `Schema.Create`. For production this would move to versioned migrations (e.g. Atlas).

## Environment variables

**Backend** (`backend/.env.example`):

| Var               | Required | Notes                                                    |
|-------------------|----------|----------------------------------------------------------|
| `PORT`            | yes      | Defaults to `8080`.                                      |
| `DATABASE_URL`    | yes      | Postgres DSN; `sslmode=disable` for local dev.           |
| `CORS_ORIGIN`     | yes      | Allowed origin for the frontend (e.g. `http://localhost:3000`). |
| `GITHUB_TOKEN`    | no       | PAT; raises the GitHub rate limit. Unset works for low volume. |
| `GITHUB_BASE_URL` | no       | Overridable for tests; defaults to `https://api.github.com`. |

**Frontend** (`frontend/.env.example`):

| Var                        | Required | Notes                                       |
|----------------------------|----------|---------------------------------------------|
| `NEXT_PUBLIC_API_BASE_URL` | yes      | Backend base URL used by `lib/api/client.ts`. |

## API overview

Base path: `/api`. JSON in, JSON out. Errors always use:

```json
{ "error": { "code": "DUPLICATE", "message": "Repo already tracked" } }
```

| Method | Path                       | Purpose                                       | Success |
|--------|----------------------------|-----------------------------------------------|---------|
| POST   | `/api/repos`               | Add a repo by `{owner, name}`; fetches metadata from GitHub. | 201 |
| GET    | `/api/repos`               | List with optional `?language=` and `?sort=`. | 200 |
| GET    | `/api/repos/stats`         | `{ total, total_stars, top_language }`.       | 200 |
| GET    | `/api/repos/:id`           | Single repo.                                  | 200 |
| PATCH  | `/api/repos/:id`           | Update notes (`{ "notes": string }`).         | 200 |
| DELETE | `/api/repos/:id`           | Remove from watchlist.                        | 204 |
| POST   | `/api/repos/:id/refresh`   | Re-fetch metadata from GitHub.                | 200 |

Error codes: `VALIDATION` (400), `NOT_FOUND` (404), `GITHUB_NOT_FOUND` (404), `DUPLICATE` (409), `GITHUB_RATE_LIMITED` (429), `UPSTREAM` (502), `INTERNAL` (500).

## Filtering and sorting

Filters and sort live in the URL (`/?language=Go&sort=stars_desc`) so refresh/share preserves the view. The frontend reads them from `searchParams` and includes them in the React Query key (`["repos", { language, sort }]`), so each filter set is cached independently.

- `language`: case-insensitive exact match; trimmed; empty means "all".
- `sort`: one of `created_desc` (default), `stars_desc`, `stars_asc`. Anything else returns `400 VALIDATION`.

Both are applied server-side via Ent (the `language` and `stars` columns are indexed).

## Optimistic updates

Two mutations apply changes to the React Query cache before the server responds:

- **Edit notes** (`useUpdateNotes`): `onMutate` cancels in-flight `["repos"]` queries, snapshots the previous notes from every cached list and the per-repo cache, then writes the new notes into both. `onError` restores the snapshot. `onSettled` invalidates `["repos"]` and `["repo", id]` so the next read reflects the canonical server state. Net result: the UI updates instantly on keystroke-save, and reverts cleanly if the request fails.
- **Refresh row** (`useRefreshRepo`): the row shows a spinner via mutation `isPending`; on success the returned row replaces the cached entry, so stars/language/`fetched_at` update without a full list refetch.

Creates and deletes are not optimistic — they invalidate `["repos"]` and `["stats"]` on success. The complexity wasn't worth it for actions that already feel fast.

## Tradeoffs and design decisions

- **Layered Go, not hexagonal.** Handlers → service → repository → Ent, plus a GitHub client called from the service. Interfaces are introduced only where tests need substitution (e.g. the handler's `repoService`), not preemptively.
- **Ent over `database/sql`/sqlc.** Schema-as-code and free migrations on boot were worth more than raw SQL control at this scope. Indexes are declared on the schema (`full_name` unique, `language`, `stars`).
- **Single error envelope.** All non-2xx responses share `{ error: { code, message } }`. Domain errors map to HTTP codes in one place (`internal/httpapi/apierror`); the frontend branches on `code` for tailored messages (`DUPLICATE`, `GITHUB_NOT_FOUND`, …) and falls back to a generic message otherwise.
- **React Query owns server state.** No Redux/Zustand; no global UI store. Filters live in the URL; ephemeral UI state lives in `useState`. Query keys include the filter object so caches don't collide.
- **Client-side data fetching, not RSC fetching.** This app is mutation-heavy. Mixing RSC fetch with React Query mutations adds friction; picking one keeps cache invalidation predictable.
- **No auth, no background workers, no caching layer.** Per the project's non-goals: refresh is on-demand, not scheduled; GitHub responses aren't cached beyond what's persisted.
- **Schema applied on boot.** Fine for dev; a real deployment would switch to Atlas-generated versioned migrations.
- **Frontend Dockerfile pinned to `linux/amd64`.** Avoids native dependency churn between Apple Silicon hosts and the Next dev container.

## AI usage disclosure

This project was built collaboratively with **Claude Code** (Anthropic's CLI).

**How Claude Code was used.** Claude generated almost all of the production code — Ent schema, service/repository layers, handlers, GitHub client, the typed frontend API client and React Query hooks, components, and Docker/compose wiring — guided by prompts that referenced `CLAUDE.md` (stack and architecture rules) and `ARCHITECTURE.md` (the up-front design plan). It also drafted tests and this README.

**How generated code was reviewed.** Every diff was read before being committed; nothing was accepted blind. Reviews focused on (a) layering — no business logic leaking into handlers, no Ent types crossing the API boundary; (b) error mapping — domain errors flowing through the single `apierror.Render` path; (c) the React Query optimistic paths, where `onMutate`/`onError`/`onSettled` interactions are easy to get subtly wrong; and (d) input validation on both sides. Suggestions that drifted from the conventions in `CLAUDE.md` (e.g. premature abstractions, comments restating the code, unnecessary fallbacks) were rejected and re-prompted.

**Phased implementation workflow.** The work followed the architecture plan in deliberate slices, one per commit, so each step could be verified before the next:
1. Scaffold (modules, configs, Docker) — no logic.
2. Backend domain: Ent schema → repository → service → GitHub client.
3. HTTP layer: error envelope → handlers → routing → stats endpoint.
4. Backend tests (service-level with an `httptest` GitHub stub).
5. Frontend scaffold: typed API client, query provider, base shell.
6. Components in dependency order: stats → list → filters → add form → row actions.
7. Optimistic notes + per-row delete/refresh, with tests for the rollback path.

Each phase ended with `go test ./...`, `npm run lint`, `npm run typecheck`, and a manual smoke against the running app before committing.

**Validation and testing practices.**
- Backend: service-level tests with a fake GitHub stub cover the `Create`/`Refresh` paths, validation, duplicate handling, and stats aggregation. Repository tests use a SQLite-backed Ent test client.
- Frontend: Vitest + Testing Library covers the optimistic-notes mutation, including the rollback-on-error path.
- Linting/type-checking: `go vet`, `next lint`, and `tsc --noEmit` are run before each commit and gate the "task complete" state per `CLAUDE.md`.
- Manual smoke: per the architecture doc — add a real repo, duplicate-add (expect 409), bogus owner (expect 404 `GITHUB_NOT_FOUND`), filter/sort URL persistence, optimistic notes edit, refresh, delete.