package database

import (
	"context"
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

func NewMongoClient(ctx context.Context) *MongoClient {
	uri := utils.GetMongoURI()
	if uri == "" {
		log.Fatal("MONGODB_URI not set in environment variables")
	}

	client, err := mongo.Connect(ctx, options.Client().
		ApplyURI(uri).
		SetServerAPIOptions(options.ServerAPI(options.ServerAPIVersion1)).
		SetMaxPoolSize(100).
		SetMinPoolSize(10).
		SetMaxConnIdleTime(5*time.Minute))

	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	// Verify connection
	ctxPing, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err = client.Ping(ctxPing, readpref.Primary()); err != nil {
		log.Fatalf("Failed to ping MongoDB: %v", err)
	}

	db := client.Database("gemini_chat")
	log.Println("Successfully connected to MongoDB!")

	return &MongoClient{
		Client: client,
		DB:     db,
	}
}

func (mc *MongoClient) HealthCheck(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return mc.Client.Ping(ctx, readpref.Primary())
}
