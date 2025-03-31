package utils

import (
	"html"
	"strings"
)

func SanitizeInput(input string) string {
	cleaned := strings.TrimSpace(input)
	cleaned = html.EscapeString(cleaned)
	return strings.ReplaceAll(cleaned, "\n", " ")
}
