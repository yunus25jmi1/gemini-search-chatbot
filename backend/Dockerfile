# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy dependency files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /app/gemini-chatbot ./cmd/main.go

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Copy binary and configs from builder
COPY --from=builder /app/gemini-chatbot .
COPY .env .

# Install CA certificates for HTTPS
RUN apk --no-cache add ca-certificates tzdata

# Set timezone (optional)
ENV TZ=UTC

# Expose HTTP port
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
USER nobody:nobody
ENTRYPOINT ["./gemini-chatbot"]