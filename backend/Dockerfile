# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Copy dependency files first
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /app/gemini-chatbot ./main.go

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/gemini-chatbot .

# Install CA certificates
RUN apk --no-cache add ca-certificates

# Expose port
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Run as non-root user
USER 65534:65534

ENTRYPOINT ["./gemini-chatbot"]