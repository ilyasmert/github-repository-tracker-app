GitHub Repository Tracker — Architecture Plan
Context
We're building a small full-stack take-home: a watchlist for GitHub repos with CRUD, a per-row refresh against the GitHub API, basic filtering/sorting, and a stats panel. The repo is currently empty (only CLAUDE.md), so this is a greenfield design.

Goals: production-quality feel without overengineering. Sharp boundaries between handlers/services/repositories on the Go side, a thin typed API layer on the Next.js side, and a Docker Compose dev loop that "just works."

Stack is fixed by CLAUDE.md:

Backend: Go 1.22, Gin, Ent, PostgreSQL
Frontend: Next.js App Router, TypeScript strict, TailwindCSS
1. Backend architecture
Strict layering, one direction of dependency (handler → service → repo → ent client; service → github client).

cmd/server — entrypoint: load config, open DB, run Ent migrations, wire dependencies, start Gin.
internal/config — env-driven config struct (PORT, DATABASE_URL, GITHUB_TOKEN, GITHUB_BASE_URL).
internal/httpapi — Gin router, middleware (request ID, recovery, CORS, structured logging), error mapper, DTOs.
handlers/ — thin: parse, validate, call service, render. No business logic.
dto/ — request/response shapes, decoupled from Ent entities.
errors.go — APIError type + Render(c, err) helper that maps domain errors → HTTP status + JSON body.
internal/repos — domain package for the "tracked repo" feature.
service.go — orchestration: dedup checks, calling GitHub client, persisting via repository, computing stats.
repository.go — Ent queries only. Exposes Create / Get / List(filter) / Update / Delete / Exists.
domain_errors.go — ErrNotFound, ErrDuplicate, ErrGitHubNotFound, ErrGitHubRateLimited, ErrUpstream.
internal/github — typed client around api.github.com.
client.go — GetRepo(ctx, owner, name) returns a normalized struct; handles 404 → ErrGitHubNotFound, 403 with rate-limit headers → ErrGitHubRateLimited, attaches Authorization: Bearer $GITHUB_TOKEN when present, sets Accept: application/vnd.github+json and a User-Agent.
Uses http.Client with a 10s timeout and context.Context everywhere.
ent/ — generated Ent code (committed). Schemas live in ent/schema/.
Why layered like this: the GitHub side-effect is the only thing that makes this non-trivial. Keeping the service the one place that knows "create = fetch + persist" and "refresh = fetch + update" prevents handlers from drifting into business logic (per CLAUDE.md).

2. Frontend architecture
App Router, server components for static shells, client components where interactivity lives. No global store — React Query owns server state.

app/page.tsx — server component: renders the page shell + <StatsPanel/> + <RepoListContainer/>. No data fetching in RSC for this app; we let the client do it so React Query owns caching and revalidation uniformly. (RSC fetch is fine too, but mixing it with mutation-heavy interactivity adds friction for a small app — pick one and stay consistent.)
components/
StatsPanel.tsx — pulls /api/repos/stats via React Query.
AddRepoForm.tsx — controlled form, react-hook-form + zod for inline validation, mutation hook, surfaces 409/404 from the API distinctly.
RepoList.tsx — receives filtered/sorted query params from FiltersBar; explicit loading skeleton / empty state / error state.
RepoRow.tsx — per-row actions: refresh (optimistic spinner), edit notes (inline), delete (confirm modal).
FiltersBar.tsx — language <select> + stars sort toggle; pushes state into URL search params so refresh preserves view.
ConfirmDialog.tsx — generic confirmation.
lib/api/ — the typed API client.
types.ts — shared request/response types (single source of truth).
client.ts — apiFetch<T>(path, init) wrapper: JSON, throws typed ApiError on non-2xx by reading the standard {error:{code,message}} shape.
repos.ts — thin functions per endpoint (listRepos, createRepo, refreshRepo, …).
lib/hooks/ — React Query hooks (useRepos, useStats, useCreateRepo, etc.). All mutations invalidate the relevant query keys; useUpdateNotes and useRefreshRepo use optimistic updates.
3. Folder structure
repository-tracker-app/
├── CLAUDE.md
├── README.md
├── docker-compose.yml
├── Makefile
├── backend/
│   ├── go.mod
│   ├── .env.example
│   ├── Dockerfile
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── config/config.go
│   │   ├── github/client.go
│   │   ├── httpapi/
│   │   │   ├── router.go
│   │   │   ├── errors.go
│   │   │   ├── middleware.go
│   │   │   ├── dto/repo.go
│   │   │   └── handlers/repos.go
│   │   └── repos/
│   │       ├── service.go
│   │       ├── repository.go
│   │       └── domain_errors.go
│   └── ent/
│       ├── schema/trackedrepo.go
│       └── (generated…)
└── frontend/
    ├── package.json
    ├── tsconfig.json (strict: true)
    ├── next.config.mjs
    ├── tailwind.config.ts
    ├── .env.example
    ├── Dockerfile (dev)
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── providers.tsx        # QueryClientProvider
    │   └── globals.css
    ├── components/…
    └── lib/
        ├── api/{client.ts,repos.ts,types.ts}
        └── hooks/…
4. Data flow
Add a repo

Form → useCreateRepo mutation → POST /api/repos.
Handler validates body → service.
Service: repository.Exists(full_name) → if true, ErrDuplicate → 409.
Service: github.GetRepo(owner, name) → 404 → ErrGitHubNotFound → 404 to client.
Service: build entity, repository.Create, return DTO.
Client: on success, invalidate ["repos", filters] and ["stats"].
Refresh a repo

Row → useRefreshRepo → POST /api/repos/:id/refresh.
Service: load by id, call GitHub, update mutable fields + fetched_at, persist, return DTO.
Client: optimistic spinner via mutation state; on success replace row data.
Edit notes (optimistic)

useUpdateNotes → PATCH /api/repos/:id.
React Query onMutate writes the new notes into the cache; onError rolls back; onSettled invalidates list.
List with filter/sort

URL: /?language=Go&sort=stars_desc.
FiltersBar updates search params; useRepos reads them and keys the query accordingly so caching works per-filter-set.
5. API design decisions
Base path: /api. Version unprefixed — fine for a take-home; easy to add /v1 later.
Request bodies are JSON; responses are JSON. UTC ISO-8601 timestamps.
POST /api/repos body: { "owner": string, "name": string }. Validation: non-empty, regex ^[A-Za-z0-9][A-Za-z0-9._-]*$, length ≤ 100.
GET /api/repos:
?language=Go — exact match (case-insensitive) on language.
?sort=stars_desc (also accept stars_asc, default created_desc).
GET /api/repos/stats returns { total: int, total_stars: int, top_language: string | null }. Computed in a single SQL query via Ent aggregation; top_language excludes null/empty.
PATCH /api/repos/:id accepts { "notes": string } only — keeps surface area minimal and matches "user-editable notes field."
IDs are integers (Ent default). Internal only; clients treat them as opaque.
Status codes: 200 OK, 201 Created on POST /api/repos, 204 No Content on DELETE, 400 validation, 404 not found, 409 duplicate, 422 upstream-not-found (or 404 — see decision in Q1 below), 502 upstream failure, 429 upstream rate-limited.
6. Ent schema proposal
ent/schema/trackedrepo.go:

Field	Type	Notes
id	int	Ent default PK
owner	string	not empty
name	string	not empty
full_name	string	unique, format owner/name, indexed
description	string	optional, MaxLen(1024)
stars	int	default 0, non-negative
language	string	optional, indexed (filtering)
html_url	string	not empty
notes	string	optional, MaxLen(2000), default ""
fetched_at	time.Time	set on create + refresh
created_at	time.Time	Default(time.Now).Immutable()
updated_at	time.Time	Default(time.Now).UpdateDefault(time.Now)
Indexes: unique on full_name; non-unique on language and stars (sorting).

Migrations: use Ent's Schema.Create(ctx, schema.WithGlobalUniqueID(true)) on boot for dev simplicity; README notes that for production we'd switch to versioned migrations via atlas or ent migrate diff.

7. Error handling strategy
Single response shape across all error paths:

{ "error": { "code": "DUPLICATE", "message": "Repo already tracked" } }
Domain errors (ErrNotFound, ErrDuplicate, ErrGitHubNotFound, ErrGitHubRateLimited, ErrUpstream) live in internal/repos/domain_errors.go.
httpapi/errors.go has a single Render(c *gin.Context, err error) that switches on errors.Is to map to (status, code). Unknown errors → 500 with code: "INTERNAL" and a logged request ID.
Validation errors (Gin's ShouldBindJSON + struct tags) → 400 with code: "VALIDATION" and a human message; details kept short.
Logs: structured (slog), include request ID, method, path, status, latency, and — for 5xx — the underlying error. Don't log GitHub tokens.
Frontend:

apiFetch parses the error envelope and throws ApiError(code, message, status).
Form/mutation UIs branch on error.code (DUPLICATE, GITHUB_NOT_FOUND, VALIDATION) for tailored messages; everything else falls back to a generic "Something went wrong."
8. Frontend state management
Server state: TanStack Query (@tanstack/react-query). One QueryClient in app/providers.tsx.
Query keys: ["repos", {language, sort}], ["repo", id], ["stats"].
Mutations invalidate the right keys; notes + refresh use onMutate optimistic updates.
URL state: filters/sort live in searchParams via next/navigation so refresh/share preserves view.
Local UI state: useState in components (modal open, inline-edit buffers). No global UI store — overkill for this scope.
Forms: react-hook-form + zod resolver. Zod schema is co-located with the form; not shared with backend (backend has its own Gin validation — fine for a small app, not worth wiring shared schemas).
9. Docker / dev workflow
docker-compose.yml services:

db — postgres:16-alpine, healthcheck, volume pgdata.
backend — built from backend/Dockerfile, depends_on db healthy, hot-reload optional via air in a dev override (skip if it adds friction).
frontend — built from frontend/Dockerfile, runs next dev, depends_on backend.
Makefile shortcuts:

make up / make down — compose lifecycle
make backend / make frontend — run locally without compose (against compose Postgres)
make generate — go generate ./ent to regenerate Ent code
make test — go test ./...
make lint — go vet ./... + golangci-lint run (if installed) + next lint
.env.example files at backend/ and frontend/ document required vars. README has a 5-line quickstart: clone → cp .env.example .env → make up → open localhost:3000.

10. Recommended commit breakdown
Small logical commits per CLAUDE.md Git Rules:

chore: scaffold backend module and config
feat(backend): ent schema for tracked_repo + generated code
feat(backend): github client with optional token
feat(backend): repos service + repository layer
feat(backend): http handlers + error envelope + middleware
feat(backend): stats endpoint
test(backend): service-level tests with httptest GitHub stub
chore: dockerfile + compose for db + backend
chore: scaffold next.js app (strict TS, tailwind)
feat(frontend): typed api client + react-query providers
feat(frontend): repo list + filters + stats panel
feat(frontend): add-repo form with validation + error states
feat(frontend): notes edit (optimistic) + delete confirm + per-row refresh
chore: frontend dockerfile + compose wiring
docs: README quickstart + env examples
Critical files to create
Backend:

backend/cmd/server/main.go
backend/internal/config/config.go
backend/internal/github/client.go
backend/internal/repos/{service.go,repository.go,domain_errors.go}
backend/internal/httpapi/{router.go,errors.go,middleware.go}
backend/internal/httpapi/handlers/repos.go
backend/internal/httpapi/dto/repo.go
backend/ent/schema/trackedrepo.go
Frontend:

frontend/app/{layout.tsx,page.tsx,providers.tsx}
frontend/lib/api/{client.ts,repos.ts,types.ts}
frontend/lib/hooks/{useRepos.ts,useStats.ts,useCreateRepo.ts,useRefreshRepo.ts,useUpdateNotes.ts,useDeleteRepo.ts}
frontend/components/{StatsPanel.tsx,AddRepoForm.tsx,FiltersBar.tsx,RepoList.tsx,RepoRow.tsx,ConfirmDialog.tsx}
Infra:

docker-compose.yml, Makefile, README.md, backend/Dockerfile, frontend/Dockerfile, backend/.env.example, frontend/.env.example
Verification
End-to-end smoke after implementation:

make up — Postgres + backend + frontend boot, no errors in logs.
curl localhost:8080/api/repos → [].
curl -X POST localhost:8080/api/repos -d '{"owner":"golang","name":"go"}' -H 'content-type: application/json' → 201 with stored record.
Repeat the same POST → 409 with code: "DUPLICATE".
POST with bogus owner/name → 404 with code: "GITHUB_NOT_FOUND".
GET /api/repos/stats → totals reflect what's stored.
Open http://localhost:3000: stats panel populated, list renders, add form validates empty inputs inline, filter and sort update the URL and the list, notes edit shows immediate optimistic change then settles, delete prompts confirmation, refresh shows per-row spinner.
go test ./... passes. next lint clean. No console errors in browser.