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

type LogEntry struct {
	Step    string `json:"step"`
	Status  string `json:"status"` // planning, searching, analyzing, finalizing
	Message string `json:"message"`
}

type ChatResponse struct {
	Response    string     `json:"response"`
	Sources     []string   `json:"sources,omitempty"`
	ThinkingLog []LogEntry `json:"thinking_log"`
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

	cleanMessage := utils.SanitizeInput(req.Message)
	if cleanMessage == "" {
		http.Error(w, "Empty message", http.StatusBadRequest)
		return
	}

	response, sources, thinkingLog, err := h.generateResponse(r.Context(), cleanMessage, req.SearchEnabled)
	if err != nil {
		log.Printf("Generation error: %v", err)
		http.Error(w, "Failed to generate response", http.StatusInternalServerError)
		return
	}

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

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://yunus25jmi1.github.io")
	json.NewEncoder(w).Encode(ChatResponse{
		Response:    response,
		Sources:     sources,
		ThinkingLog: thinkingLog,
	})
}

func (h *ChatHandler) generateResponse(ctx context.Context, message string, searchEnabled bool) (string, []string, []LogEntry, error) {
	thinkingLog := []LogEntry{
		{Step: "1", Status: "planning", Message: "Analyzing query structure and intent..."},
		{Step: "2", Status: "searching", Message: "Identifying relevant information sources..."},
	}

	model := h.GeminiClient.GenerativeModel("gemini-2.0-flash-thinking-exp-01-21")
	model.SetTemperature(0.9)
	model.SetTopP(0.95)
	model.SetMaxOutputTokens(2048)

	prompt := message
	var sources []string
	if searchEnabled {
		thinkingLog = append(thinkingLog, LogEntry{Step: "3", Status: "analyzing", Message: "Enhancing prompt with additional search context..."})
		// Placeholder for search enhancement
		// prompt = enhancePromptWithSearch(message)
		// sources = getSourcesFromSearch()
	}

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", nil, thinkingLog, fmt.Errorf("generation failed: %w", err)
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return "", nil, thinkingLog, fmt.Errorf("empty response from API")
	}

	part := resp.Candidates[0].Content.Parts[0]
	text, ok := part.(genai.Text)
	if !ok {
		return "", nil, thinkingLog, fmt.Errorf("unexpected response type: %T", part)
	}

	thinkingLog = append(thinkingLog, LogEntry{Step: "4", Status: "finalizing", Message: "Finalizing response output..."})

	return string(text), sources, thinkingLog, nil
}
