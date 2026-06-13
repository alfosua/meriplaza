.PHONY: test build vet run-fiscal tidy

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
