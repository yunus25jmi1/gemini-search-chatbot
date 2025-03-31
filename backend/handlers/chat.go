package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/generative-ai-go/genai"
	"github.com/yunus25jmi1/gemini-search-chatbot/backend/database"
	"github.com/yunus25jmi1/gemini-search-chatbot/backend/models"
	"github.com/yunus25jmi1/gemini-search-chatbot/backend/utils"
	"google.golang.org/api/option"
)

type ChatRequest struct {
	Message       string `json:"message"`
	SearchEnabled bool   `json:"search_enabled"`
}

type ChatResponse struct {
	Response string   `json:"response"`
	Sources  []string `json:"sources,omitempty"`
}

type ChatHandler struct {
	MongoClient  *database.MongoClient
	GeminiClient *genai.Client
}

func NewChatHandler(mongoClient *database.MongoClient) *ChatHandler {
	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(utils.GetGeminiKey()))
	if err != nil {
		log.Fatalf("Failed to create Gemini client: %v", err)
	}
	return &ChatHandler{
		MongoClient:  mongoClient,
		GeminiClient: client,
	}
}

func (h *ChatHandler) HandleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Sanitize input
	cleanMessage := utils.SanitizeInput(req.Message)
	if cleanMessage == "" {
		http.Error(w, "Empty message", http.StatusBadRequest)
		return
	}

	// Generate response
	response, sources, err := h.generateResponse(r.Context(), cleanMessage, req.SearchEnabled)
	if err != nil {
		log.Printf("Generation error: %v", err)
		http.Error(w, "Failed to generate response", http.StatusInternalServerError)
		return
	}

	// Save to database
	chatMsg := models.ChatMessage{
		SessionID:      r.Header.Get("X-Session-ID"),
		UserMessage:    cleanMessage,
		GeminiResponse: response,
		SearchUsed:     req.SearchEnabled,
		Sources:        sources,
		Timestamp:      time.Now(),
	}

	collection := h.MongoClient.DB.Collection("chat_messages")
	if _, err := collection.InsertOne(r.Context(), chatMsg); err != nil {
		log.Printf("Database save error: %v", err)
	}

	// Return response
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://yunus25jmi1.github.io")
	json.NewEncoder(w).Encode(ChatResponse{
		Response: response,
		Sources:  sources,
	})
}

func (h *ChatHandler) generateResponse(ctx context.Context, message string, searchEnabled bool) (string, []string, error) {
	model := h.GeminiClient.GenerativeModel("gemini-1.5-flash")

	// Configure generation parameters
	model.SetTemperature(0.9)
	model.SetTopP(0.95)
	model.SetMaxOutputTokens(2048)

	// If search enabled, enhance prompt (implement search integration)
	prompt := message
	var sources []string
	if searchEnabled {
		// Placeholder for search integration
		// prompt = enhancePromptWithSearch(message)
		// sources = getSourcesFromSearch()
	}

	// Generate content
	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", nil, fmt.Errorf("generation failed: %w", err)
	}

	// Extract response
	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return "", nil, fmt.Errorf("empty response from API")
	}

	part := resp.Candidates[0].Content.Parts[0]
	text, ok := part.(genai.Text)
	if !ok {
		return "", nil, fmt.Errorf("unexpected response type: %T", part)
	}

	return string(text), sources, nil
}
