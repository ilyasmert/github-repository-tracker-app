.PHONY: up down logs ps backend frontend tidy generate test lint fmt clean

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

backend:
	cd backend && go run ./cmd/server

frontend:
	cd frontend && npm run dev

tidy:
	cd backend && go mod tidy

generate:
	cd backend && go generate ./...

test:
	cd backend && go test ./...

lint:
	cd backend && go vet ./...
	cd frontend && npm run lint

fmt:
	cd backend && gofmt -w .

clean:
	docker compose down -v