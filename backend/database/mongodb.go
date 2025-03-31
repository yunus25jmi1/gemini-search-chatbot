package database

import (
	"context"
	"crypto/tls"
	"log"
	"time"

	"github.com/yunus25jmi1/gemini-search-chatbot/backend/utils"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

type MongoClient struct {
	Client *mongo.Client
	DB     *mongo.Database
}

func (mc *MongoClient) Disconnect(ctx context.Context) any {
	panic("unimplemented")
}

func NewMongoClient(ctx context.Context) *MongoClient {
	uri := utils.GetMongoURI()
	if uri == "" {
		log.Fatal("MONGODB_URI not set in environment variables")
	}

	// Add TLS configuration
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
	}

	client, err := mongo.Connect(ctx, options.Client().
		ApplyURI(uri).
		SetTLSConfig(tlsConfig).
		SetServerAPIOptions(options.ServerAPI(options.ServerAPIVersion1)).
		SetConnectTimeout(15*time.Second).
		SetServerSelectionTimeout(15*time.Second))

	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	// Verify connection with longer timeout
	ctxPing, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	if err = client.Ping(ctxPing, readpref.Primary()); err != nil {
		log.Fatalf("Failed to ping MongoDB: %v", err)
	}

	log.Println("Successfully connected to MongoDB!")
	return &MongoClient{
		Client: client,
		DB:     client.Database("gemini_chat"),
	}
}

func (mc *MongoClient) HealthCheck(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return mc.Client.Ping(ctx, readpref.Primary())
}
