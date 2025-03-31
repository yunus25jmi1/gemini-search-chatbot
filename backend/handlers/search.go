package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/yunus25jmi1/gemini-search-chatbot/backend/database"
	"github.com/yunus25jmi1/gemini-search-chatbot/backend/models"
	"github.com/yunus25jmi1/gemini-search-chatbot/backend/utils"
)

type SearchHandler struct {
	MongoClient *database.MongoClient
}

type SearchRequest struct {
	Query string `json:"query"`
}

type SearchResponse struct {
	Results []models.SearchResultItem `json:"results"`
}

func NewSearchHandler(mongoClient *database.MongoClient) *SearchHandler {
	return &SearchHandler{
		MongoClient: mongoClient,
	}
}

func (h *SearchHandler) HandleSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	cleanQuery := utils.SanitizeInput(req.Query)
	if cleanQuery == "" {
		http.Error(w, "Empty query", http.StatusBadRequest)
		return
	}

	results, err := h.performSearch(r.Context(), cleanQuery)
	if err != nil {
		http.Error(w, "Search failed", http.StatusInternalServerError)
		return
	}

	// Save search results
	searchDoc := models.SearchResult{
		Query:     cleanQuery,
		Results:   results,
		Timestamp: time.Now(),
	}

	collection := h.MongoClient.DB.Collection("search_results")
	if _, err := collection.InsertOne(r.Context(), searchDoc); err != nil {
		log.Printf("Failed to save search results: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SearchResponse{
		Results: results,
	})
}

func (h *SearchHandler) performSearch(ctx context.Context, query string) ([]models.SearchResultItem, error) {
	// Implement actual search API integration here
	// Example using Google Custom Search API:
	/*
	   url := fmt.Sprintf(
	       "https://www.googleapis.com/customsearch/v1?key=%s&cx=%s&q=%s",
	       utils.GetSearchAPIKey(),
	       utils.GetSearchEngineID(),
	       url.QueryEscape(query),
	   )

	   resp, err := http.Get(url)
	   // ... process response ...
	*/

	// Temporary mock data
	return []models.SearchResultItem{
		{
			Title:   "Example Search Result",
			URL:     "https://example.com",
			Snippet: "This is a sample search result snippet.",
		},
	}, nil
}
