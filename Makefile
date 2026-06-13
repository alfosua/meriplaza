.PHONY: test build vet run-fiscal run-payments run-catalog tidy

test:
	go test ./...

vet:
	go vet ./...

build:
	go build ./...

tidy:
	go mod tidy

run-fiscal:
	go run ./services/fiscal/cmd/fiscald

run-payments:
	go run ./services/payments/cmd/paymentsd

run-catalog:
	go run ./services/catalog/cmd/catalogd
