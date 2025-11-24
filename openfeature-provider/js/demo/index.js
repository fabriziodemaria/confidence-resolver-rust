import { OpenFeature } from '@openfeature/server-sdk';
import { createConfidenceServerProvider } from '@spotify-confidence/openfeature-server-provider-local';
import 'dotenv/config';

const RESOLVE_INTERVAL_MS = 5000;  // 5 seconds

async function main() {
  // Load configuration from environment variables
  const apiClientId = process.env.CONFIDENCE_API_CLIENT_ID;
  const apiClientSecret = process.env.CONFIDENCE_API_CLIENT_SECRET;
  const flagClientSecret = process.env.CONFIDENCE_CLIENT_SECRET;

  // Validate configuration
  if (!apiClientId || !apiClientSecret || !flagClientSecret) {
    console.error('ERROR: Missing required environment variables:');
    console.error('  - CONFIDENCE_API_CLIENT_ID');
    console.error('  - CONFIDENCE_API_CLIENT_SECRET');
    console.error('  - CONFIDENCE_CLIENT_SECRET');
    console.error('\nExample:');
    console.error('  export CONFIDENCE_API_CLIENT_ID="your-api-client-id"');
    console.error('  export CONFIDENCE_API_CLIENT_SECRET="your-api-client-secret"');
    console.error('  export CONFIDENCE_CLIENT_SECRET="your-client-secret"');
    process.exit(1);
  }

  console.log('Starting Confidence OpenFeature Local Provider Demo (JavaScript)');
  console.log('');

  // Create provider
  console.log('Creating Confidence provider...');
  const provider = createConfidenceServerProvider({
    flagClientSecret,
    apiClientId,
    apiClientSecret,
  });

  // Register with OpenFeature and wait for initialization
  await OpenFeature.setProviderAndWait(provider);
  console.log('Confidence provider initialized successfully');
  console.log('');

  // Create OpenFeature client
  const client = OpenFeature.getClient('demo-app');

  // Evaluation context that will be updated
  let evaluationContext = {
    targetingKey: 'user-123',
    user_id: 'vahid',
    visitor_id: 'vahid',
  };

  console.log('=== Starting Continuous Flag Evaluation ===');
  console.log(`Resolving flag every ${RESOLVE_INTERVAL_MS / 1000} seconds`);
  console.log('Press Ctrl+C to stop');
  console.log('');

  // Resolve flag every 5 seconds
  setInterval(async () => {
    try {
      const details = await client.getObjectDetails(
        'mattias-boolean-flag',
        {},
        evaluationContext
      );
      console.log(`[${new Date().toISOString()}] Flag resolved:`, {
        value: details.value,
        variant: details.variant,
        reason: details.reason,
        errorCode: details.errorCode,
        errorMessage: details.errorMessage,
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error resolving flag:`, error.message);
    }
  }, RESOLVE_INTERVAL_MS);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down gracefully...');
    await provider.onClose();
    console.log('Shutdown complete');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
