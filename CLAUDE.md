# Project Rules

## Stack
- Backend: Go 1.25, Gin, Ent, PostgreSQL
- Frontend: Next.js App Router, TypeScript strict mode
- Styling: TailwindCSS

## Architecture Rules
- Keep backend layered:
  - handlers
  - services
  - repositories/db
  - github client
- No business logic in handlers
- Use DTOs for API responses
- Consistent JSON error shape

## Code Quality
- Prefer small focused files
- Avoid premature abstractions
- Add comments only where useful

## Frontend Rules
- Centralized typed API client
- Avoid duplicated types
- Handle loading/error/empty states explicitly
- Prefer server-safe patterns in Next.js

## Git Rules
- Make small logical commits
- After each completed task:
  - run tests
  - run linters
  - summarize changes
  - suggest a commit message

## Non-Goals
- Do not introduce microservices
- Do not add authentication
- Do not add caching layers
- Do not add background workers
- Do not introduce complex state management
- Keep the project pragmatic for a take-home assignment

## Verification
Before completing a task:
- run go test ./...
- run npm run lint
- run npm run type-check
- verify no TypeScript errors
- verify no console errors