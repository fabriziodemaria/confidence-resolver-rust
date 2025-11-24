package com.spotify.confidence.demo;

import com.spotify.confidence.ApiSecret;
import com.spotify.confidence.OpenFeatureLocalResolveProvider;
import dev.openfeature.sdk.Client;
import dev.openfeature.sdk.EvaluationContext;
import dev.openfeature.sdk.MutableContext;
import dev.openfeature.sdk.OpenFeatureAPI;
import dev.openfeature.sdk.Value;
import java.util.Map;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Main {
  private static final Logger logger = LoggerFactory.getLogger(Main.class);
  private static final AtomicLong totalSuccess = new AtomicLong(0);
  private static final AtomicLong totalErrors = new AtomicLong(0);
  private static volatile long startTime;

  public static void main(String[] args) {
    // Load configuration from environment variables
    String apiClientId = getEnvOrDefault("CONFIDENCE_API_CLIENT_ID", "API_ID");
    String apiClientSecret = getEnvOrDefault("CONFIDENCE_API_CLIENT_SECRET", "API_SECRET");
    String clientSecret = getEnvOrDefault("CONFIDENCE_CLIENT_SECRET", "CLIENT_SECRET");

    // Validate configuration - fail fast on placeholder credentials
    if ("API_ID".equals(apiClientId)
        || "API_SECRET".equals(apiClientSecret)
        || "CLIENT_SECRET".equals(clientSecret)) {
      logger.error(
          "ERROR: Placeholder credentials detected. Please set environment variables:\n"
              + "  - CONFIDENCE_API_CLIENT_ID\n"
              + "  - CONFIDENCE_API_CLIENT_SECRET\n"
              + "  - CONFIDENCE_CLIENT_SECRET\n\n"
              + "Example:\n"
              + "  export CONFIDENCE_API_CLIENT_ID=\"your-api-client-id\"\n"
              + "  export CONFIDENCE_API_CLIENT_SECRET=\"your-api-client-secret\"\n"
              + "  export CONFIDENCE_CLIENT_SECRET=\"your-client-secret\"\n");
      System.exit(1);
    }

    logger.info("Starting Confidence OpenFeature Local Provider Demo");
    logger.info("");

    // Create provider with configuration
    logger.info("Creating Confidence provider...");
    ApiSecret apiSecret = new ApiSecret(apiClientId, apiClientSecret);
    OpenFeatureLocalResolveProvider provider =
        new OpenFeatureLocalResolveProvider(apiSecret, clientSecret);

    // Register with OpenFeature
    OpenFeatureAPI.getInstance().setProviderAndWait(provider);
    logger.info("Confidence provider created successfully");
    logger.info("OpenFeature provider registered");
    logger.info("");

    // Create OpenFeature client
    Client client = OpenFeatureAPI.getInstance().getClient("demo-app");

    // Demo: Evaluate flags every 5 seconds indefinitely
    logger.info("=== Flag Evaluation Demo - 1 flag every 5 seconds, running indefinitely ===");
    logger.info("");

    // Create evaluation context
    MutableContext evalCtx = new MutableContext();
    evalCtx.setTargetingKey("user-123");
    evalCtx.add("user_id", "vahid");
    evalCtx.add("visitor_id", "vahid");

    logger.info("Starting continuous flag evaluation every 5 seconds...");
    logger.info("Press Ctrl+C to stop");
    logger.info("");

    startTime = System.currentTimeMillis();

    // Create executor for periodic tasks
    ScheduledExecutorService executor = new ScheduledThreadPoolExecutor(2);

    // Schedule flag evaluation every 5 seconds
    executor.scheduleAtFixedRate(
        () -> {
          try {
            // Use getObjectValue to get the full flag object
            Value result = client.getObjectValue("mattias-boolean-flag", Value.objectToValue(Map.of()), evalCtx);
            totalSuccess.incrementAndGet();

            // Log first success
            if (totalSuccess.get() == 1) {
              logger.info("First result - Value: {}", result.asObject());
            }
          } catch (Exception e) {
            totalErrors.incrementAndGet();

            // Log first error
            if (totalErrors.get() == 1) {
              logger.error("Error on first request: ", e);
            }
          }
        },
        0,
        5,
        TimeUnit.SECONDS);

    // Schedule statistics logging every 13 seconds
    executor.scheduleAtFixedRate(
        () -> {
          long duration = System.currentTimeMillis() - startTime;
          long successCount = totalSuccess.get();
          long errorCount = totalErrors.get();
          long totalRequests = successCount + errorCount;
          double throughputPerSecond = totalRequests * 1000.0 / duration;

          logger.info("");
          logger.info("=== Statistics ===");
          logger.info("Uptime: {} seconds", duration / 1000);
          logger.info(
              "Total requests: {} (successes: {}, errors: {})",
              totalRequests,
              successCount,
              errorCount);
          logger.info("Average throughput: {} requests/second", String.format("%.2f", throughputPerSecond));
          if (totalRequests > 0) {
            logger.info("Success rate: {}%", String.format("%.2f", successCount * 100.0 / totalRequests));
          }
          logger.info("");
        },
        13,
        13,
        TimeUnit.SECONDS);

    // Add shutdown hook
    Runtime.getRuntime()
        .addShutdownHook(
            new Thread(
                () -> {
                  logger.info("Shutting down...");
                  executor.shutdown();
                  try {
                    if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                      executor.shutdownNow();
                    }
                  } catch (InterruptedException e) {
                    executor.shutdownNow();
                    Thread.currentThread().interrupt();
                  }
                  OpenFeatureAPI.getInstance().shutdown();
                }));

    // Keep main thread alive
    try {
      Thread.currentThread().join();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      logger.info("Main thread interrupted");
    }
  }

  private static String getEnvOrDefault(String key, String defaultValue) {
    String value = System.getenv(key);
    return value != null ? value : defaultValue;
  }
}
