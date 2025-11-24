# Confidence OpenFeature Provider Demo

Demo application showing how to use the Confidence OpenFeature Local Provider in Java.

## Prerequisites

- Java 17+
- Maven 3.6+
- Confidence API credentials

## Setup

Set the required environment variables:

```bash
export CONFIDENCE_API_CLIENT_ID="your-api-client-id"
export CONFIDENCE_API_CLIENT_SECRET="your-api-client-secret"
export CONFIDENCE_CLIENT_SECRET="your-client-secret"
```

Get your credentials from the [Confidence dashboard](https://confidence.spotify.com/).

## Build

```bash
mvn clean package
```

## Run

Using Maven exec plugin:

```bash
mvn exec:java
```

Or run the JAR directly:

```bash
java -jar target/openfeature-provider-demo-1.0.0.jar
```

The demo continuously evaluates flags at 5 requests per second and logs statistics every minute. It runs indefinitely until stopped with Ctrl+C. The provider automatically refreshes its state every minute to demonstrate state synchronization.
