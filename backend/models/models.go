package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ChatMessage struct {
	ID             primitive.ObjectID `bson:"_id,omitempty"`
	SessionID      string             `bson:"session_id"`
	UserMessage    string             `bson:"user_message"`
	GeminiResponse string             `bson:"gemini_response"`
	SearchUsed     bool               `bson:"search_used"`
	Sources        []string           `bson:"sources,omitempty"`
	Timestamp      time.Time          `bson:"timestamp"`
}

type SearchResult struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	Query     string             `bson:"query"`
	Results   []SearchResultItem `bson:"results"`
	Timestamp time.Time          `bson:"timestamp"`
}

type SearchResultItem struct {
	Title   string `bson:"title"`
	URL     string `bson:"url"`
	Snippet string `bson:"snippet"`
}

type Session struct {
	ID         primitive.ObjectID `bson:"_id,omitempty"`
	SessionID  string             `bson:"session_id"`
	CreatedAt  time.Time          `bson:"created_at"`
	LastActive time.Time          `bson:"last_active"`
	UserAgent  string             `bson:"user_agent,omitempty"`
	IPAddress  string             `bson:"ip_address,omitempty"`
}
