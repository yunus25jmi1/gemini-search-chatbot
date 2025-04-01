package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/yunus25jmi1/gemini-search-chatbot/backend/database"
	"github.com/yunus25jmi1/gemini-search-chatbot/backend/handlers"
	"github.com/yunus25jmi1/gemini-search-chatbot/backend/utils"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	// Load environment variables
	utils.LoadConfig()

	// Create MongoDB client
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoClient := database.NewMongoClient(ctx)
	defer func() {
		if err := mongoClient.Disconnect(ctx); err != nil {
			log.Fatalf("MongoDB disconnect error: %v", err)
		}
	}()

	// Initialize handlers
	chatHandler := handlers.NewChatHandler(mongoClient)
	searchHandler := handlers.NewSearchHandler(mongoClient)

	// Configure router with API versioning
	router := http.NewServeMux()
	apiRouter := http.NewServeMux()
	apiRouter.HandleFunc("/health", healthCheckHandler)
	apiRouter.HandleFunc("/chat", chatHandler.HandleChat)
	apiRouter.HandleFunc("/search", searchHandler.HandleSearch)

	// Versioned API endpoint
	router.Handle("/api/v1/", http.StripPrefix("/api/v1", apiRouter))

	// Catch-All 404 Handler
	router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "Endpoint not found",
			"path":    r.URL.Path,
			"docs":    "https://your-docs-url.com",
			"version": "1.4.0",
		})
	})

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
		Addr:    getServerAddress(),
		Handler: h2c.NewHandler(handler, &http2.Server{}),
	}

	// Graceful shutdown setup
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	// Start server
	go func() {
		log.Printf("Server starting on %s", server.Addr)
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

	// Graceful shutdown
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Graceful shutdown failed: %v", err)
	}
	log.Println("Server stopped")
}

func getServerAddress() string {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	return ":" + port
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"version": "1.4.0",
		"service": "gemini-chatbot",
	})
}

// Middleware configuration
func applyMiddleware(h http.Handler, middleware ...func(http.Handler) http.Handler) http.Handler {
	for _, mw := range middleware {
		h = mw(h)
	}
	return h
}

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
		w.Header().Set("Access-Control-Allow-Origin", "https://yunus25jmi1.github.io")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Session-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	// Implement using github.com/ulule/limiter/v3
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func recoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("Recovered from panic: %v", err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
