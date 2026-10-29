FROM golang:1.27.3-bookworm@sha256:d9b6a1beb9474adc2a1ce842573639b44b2a0dd49b6669f51d3821baf9ec37c9 AS verify
ENV GOTOOLCHAIN=local
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY *.go ./
COPY cmd ./cmd
RUN --network=none test -z "$(gofmt -l .)" \
    && go vet ./... && go test -race -count=1 -timeout=60s -v ./...
RUN --network=none CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /usr/local/bin/oioi-waveform-runner ./cmd/waveform-runner
