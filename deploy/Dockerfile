# Multi-stage build shared by all SalesFactory services.
# Build a specific daemon with:
#   docker build -f deploy/Dockerfile --build-arg SERVICE=fiscal -t salesfactory/fiscal .
# SERVICE maps to services/<SERVICE>/cmd/<SERVICE>d.
#
# The result is a tiny static binary on a distroless base — fast to pull on
# low-bandwidth links and minimal attack surface.

FROM docker.io/library/golang:1.26-alpine AS build
ARG SERVICE
WORKDIR /src

# Cache modules first.
COPY go.mod go.sum ./
RUN go mod download

# Build the selected static binary.
COPY . .
RUN test -n "$SERVICE" || (echo "SERVICE build-arg is required" && false)
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
    -o /out/app ./services/${SERVICE}/cmd/${SERVICE}d

# Distroless static runtime (no shell, non-root).
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/app /app
USER nonroot:nonroot
ENTRYPOINT ["/app"]
