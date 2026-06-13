# Cloudflare Containers image for the payments service.
FROM docker.io/library/golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
    -o /out/app ./services/payments/cmd/paymentsd

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/app /app
ENV PAYMENTS_ADDR=:8080
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app"]
