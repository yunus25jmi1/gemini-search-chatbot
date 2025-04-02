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
	utils.LoadConfig()

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

	// Configure versioned API router
	apiRouter := http.NewServeMux()
	apiRouter.HandleFunc("/health", healthCheckHandler)
	apiRouter.HandleFunc("/chat", chatHandler.HandleChat)
	apiRouter.HandleFunc("/search", searchHandler.HandleSearch)

	// Main router
	router := http.NewServeMux()
	router.Handle("/api/v1/", http.StripPrefix("/api/v1", apiRouter))
	router.HandleFunc("/", notFoundHandler)
	router.HandleFunc("/favicon.ico", faviconHandler)

	// Configure middleware chain
	handler := applyMiddleware(
		router,
		loggingMiddleware,
		corsMiddleware,
		rateLimitMiddleware,
		recoveryMiddleware,
	)

	// Configure HTTP/2 server with timeouts
	server := &http.Server{
		Addr:         getServerAddress(),
		Handler:      h2c.NewHandler(handler, &http2.Server{}),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Server starting on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	<-done
	log.Println("Server shutting down...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Graceful shutdown failed: %v", err)
	}
	log.Println("Server stopped")
}

func getServerAddress() string {
	if port := os.Getenv("PORT"); port != "" {
		return ":" + port
	}
	return ":8080"
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", "GET")
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"version": "1.4.0",
		"service": "gemini-chatbot",
	})
}

func notFoundHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	json.NewEncoder(w).Encode(map[string]string{
		"error":   "Endpoint not found",
		"path":    r.URL.Path,
		"docs":    "https://docs.example.com/api",
		"version": "1.4.0",
	})
}

func faviconHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", "GET")
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	http.ServeFile(w, r, "assets/favicon.ico")
}

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
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// TODO: Implement rate limiting logic
		next.ServeHTTP(w, r)
	})
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
