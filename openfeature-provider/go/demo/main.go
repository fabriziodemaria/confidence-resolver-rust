package main

import (
	"context"
	"log"
	"os"
	"sync/atomic"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/spotify/confidence-resolver/openfeature-provider/go/confidence"
)

func main() {
	ctx := context.Background()

	// Load configuration from environment variables
	apiClientID := getEnvOrDefault("CONFIDENCE_API_CLIENT_ID", "API_ID")
	apiClientSecret := getEnvOrDefault("CONFIDENCE_API_CLIENT_SECRET", "API_SECRET")
	clientSecret := getEnvOrDefault("CONFIDENCE_CLIENT_SECRET", "CLIENT_SECRET")

	// Set poll interval for state updates and log flushing to 13 seconds
	os.Setenv("CONFIDENCE_RESOLVER_POLL_INTERVAL_SECONDS", "13")

	// Validate configuration - fail fast on placeholder credentials
	if apiClientID == "API_ID" || apiClientSecret == "API_SECRET" || clientSecret == "CLIENT_SECRET" {
		log.Fatalf("ERROR: Placeholder credentials detected. Please set environment variables:\n" +
			"  - CONFIDENCE_API_CLIENT_ID\n" +
			"  - CONFIDENCE_API_CLIENT_SECRET\n" +
			"  - CONFIDENCE_CLIENT_SECRET\n\n" +
			"Example:\n" +
			"  export CONFIDENCE_API_CLIENT_ID=\"your-api-client-id\"\n" +
			"  export CONFIDENCE_API_CLIENT_SECRET=\"your-api-client-secret\"\n" +
			"  export CONFIDENCE_CLIENT_SECRET=\"your-client-secret\"\n")
	}

	log.Println("Starting Confidence OpenFeature Local Provider Demo")
	log.Println("Demo will resolve flags every 5 seconds and flush logs every 13 seconds")
	log.Println("")

	// Create provider with simple configuration
	log.Println("Creating Confidence provider...")

	provider, err := confidence.NewProvider(ctx, confidence.ProviderConfig{
		APIClientID:     apiClientID,
		APIClientSecret: apiClientSecret,
		ClientSecret:    clientSecret,
	})
	if err != nil {
		log.Fatalf("Failed to create provider: %v", err)
	}
	defer openfeature.Shutdown()
	log.Println("Confidence provider created successfully")

	// Register with OpenFeature
	err = openfeature.SetProviderAndWait(provider)
	if err != nil {
		return
	}
	log.Println("OpenFeature provider registered")
	log.Println("")

	// Create OpenFeature client
	client := openfeature.NewClient("demo-app")

	// Create evaluation context
	evalCtx := openfeature.NewEvaluationContext(
		"user-123",
		map[string]interface{}{
			"user_id":    "vahid",
			"visitor_id": "vahid",
		},
	)

	log.Println("=== Starting Flag Resolution Loop ===")
	log.Println("Resolving flags every 5 seconds indefinitely...")
	log.Println("Press Ctrl+C to stop")
	log.Println("")

	// Create a ticker for 5-second flag resolution
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	// Shared counters for statistics
	var totalSuccess, totalErrors int64

	// Resolve once immediately before starting the ticker loop
	result, err := client.ObjectValueDetails(ctx, "mattias-boolean-flag", map[string]interface{}{}, evalCtx)
	if err != nil {
		atomic.AddInt64(&totalErrors, 1)
		log.Printf("[%s] Error resolving flag: %v", time.Now().Format("15:04:05"), err)
	} else {
		atomic.AddInt64(&totalSuccess, 1)
		log.Printf("[%s] Flag resolved - Value: %+v, Variant: %s, Reason: %s",
			time.Now().Format("15:04:05"), result.Value, result.Variant, result.Reason)
	}

	// Run indefinitely, resolving flags every 5 seconds
	for range ticker.C {
		result, err := client.ObjectValueDetails(ctx, "mattias-boolean-flag", map[string]interface{}{}, evalCtx)
		if err != nil {
			atomic.AddInt64(&totalErrors, 1)
			log.Printf("[%s] Error resolving flag: %v", time.Now().Format("15:04:05"), err)
		} else {
			atomic.AddInt64(&totalSuccess, 1)
			log.Printf("[%s] Flag resolved - Value: %+v, Variant: %s, Reason: %s",
				time.Now().Format("15:04:05"), result.Value, result.Variant, result.Reason)
		}

		// Print statistics every 10 resolutions
		total := atomic.LoadInt64(&totalSuccess) + atomic.LoadInt64(&totalErrors)
		if total%10 == 0 {
			success := atomic.LoadInt64(&totalSuccess)
			errors := atomic.LoadInt64(&totalErrors)
			log.Printf("[%s] Statistics: %d total resolutions (%d successes, %d errors)",
				time.Now().Format("15:04:05"), total, success, errors)
		}
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
