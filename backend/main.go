package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/yourusername/gemini-search-chatbot/database"
	"github.com/yourusername/gemini-search-chatbot/handlers"
	"github.com/yourusername/gemini-search-chatbot/utils"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	// Load configuration
	utils.LoadConfig()

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Initialize MongoDB client
	mongoClient := database.NewMongoClient(ctx)
	defer func() {
		if err := mongoClient.Disconnect(ctx); err != nil {
			log.Fatalf("MongoDB disconnect error: %v", err)
		}
	}()

	// Initialize handlers
	chatHandler := handlers.NewChatHandler(mongoClient)
	searchHandler := handlers.NewSearchHandler(mongoClient)

	// Configure router
	router := http.NewServeMux()
	router.HandleFunc("/health", healthCheckHandler)
	router.HandleFunc("/chat", chatHandler.HandleChat)
	router.HandleFunc("/search", searchHandler.HandleSearch)

	// Configure middleware chain
	handler := applyMiddleware(
		router,
		loggingMiddleware,
		corsMiddleware,
		rateLimitMiddleware,
		recoveryMiddleware,
	)

	// Configure HTTP/2 server
	server := &http.Server{
		Addr:    ":" + getPort(),
		Handler: h2c.NewHandler(handler, &http2.Server{}),
	}

	// Graceful shutdown setup
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	// Start server
	go func() {
		log.Printf("Server starting on port %s", getPort())
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for shutdown signal
	<-done
	log.Println("Server shutting down...")

	// Create shutdown context
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Graceful shutdown failed: %v", err)
	}
	log.Println("Server stopped")
}

func getPort() string {
	if port := os.Getenv("PORT"); port != "" {
		return port
	}
	return "8080"
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

// Middleware chain setup
func applyMiddleware(h http.Handler, middleware ...func(http.Handler) http.Handler) http.Handler {
	for _, mw := range middleware {
		h = mw(h)
	}
	return h
}

// Example middleware implementations
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("Started %s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
		log.Printf("Completed %s %s in %v", r.Method, r.URL.Path, time.Since(start))
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "https://your-github-username.github.io")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Session-ID")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	// Implement using github.com/ulule/limiter/v3
	return next // Placeholder
}

func recoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("Panic recovered: %v", err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
