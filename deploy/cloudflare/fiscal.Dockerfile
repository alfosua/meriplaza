# Cloudflare Containers image for the fiscal service.
# Built from the repo-root context (wrangler runs build with cwd at repo root).
FROM docker.io/library/golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
    -o /out/app ./services/fiscal/cmd/fiscald

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/app /app
# Cloudflare routes container traffic to this port.
ENV FISCAL_ADDR=:8080
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app"]
