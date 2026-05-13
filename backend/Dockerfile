# syntax=docker/dockerfile:1
FROM golang:1.25-alpine AS build
WORKDIR /src

COPY go.mod ./
# go.sum will appear after the first `go mod tidy` run
COPY go.su[m] ./
RUN go mod download || true

COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/server /app/server
EXPOSE 8080
ENTRYPOINT ["/app/server"]