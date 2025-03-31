package utils

import (
	"os"

	"github.com/joho/godotenv"
)

func LoadConfig() {
	godotenv.Load()
}

func GetMongoURI() string {
	return os.Getenv("MONGODB_URI")
}

func GetGeminiKey() string {
	return os.Getenv("GEMINI_API_KEY")
}
