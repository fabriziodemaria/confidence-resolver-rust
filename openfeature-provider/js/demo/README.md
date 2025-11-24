# Confidence OpenFeature Provider Demo (JavaScript)

Demo application showing how to use the Confidence OpenFeature Local Provider in JavaScript/Node.js.

## Features

- Resolves the `mattias-boolean-flag` every 5 seconds
- Updates evaluation context every 13 seconds
- Runs indefinitely until manually stopped

## Prerequisites

- Node.js 18+
- Confidence API credentials

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set the required environment variables:

```bash
export CONFIDENCE_API_CLIENT_ID="your-api-client-id"
export CONFIDENCE_API_CLIENT_SECRET="your-api-client-secret"
export CONFIDENCE_CLIENT_SECRET="your-client-secret"
```

Or create a `.env` file:

```
CONFIDENCE_API_CLIENT_ID=your-api-client-id
CONFIDENCE_API_CLIENT_SECRET=your-api-client-secret
CONFIDENCE_CLIENT_SECRET=your-client-secret
```

Get your credentials from the [Confidence dashboard](https://confidence.spotify.com/).

## Run

```bash
npm start
```

The demo will run continuously, resolving the flag every 5 seconds and updating the evaluation context every 13 seconds. Press `Ctrl+C` to stop.

## Output

The demo logs each flag resolution and state update with timestamps:

```
[2024-11-24T12:00:00.000Z] Flag resolved: { value: {...}, variant: '...', reason: '...' }
[2024-11-24T12:00:13.000Z] State updated (update #1): { targetingKey: 'user-1', ... }
[2024-11-24T12:00:05.000Z] Flag resolved: { value: {...}, variant: '...', reason: '...' }
```
