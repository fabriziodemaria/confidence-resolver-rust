import 'dotenv/config';
import { OpenFeature } from '@openfeature/server-sdk';
import { createConfidenceServerProvider } from '../dist/index.node.js';

/**
 * Basic usage example with default RemoteResolverFallback strategy.
 *
 * This example demonstrates:
 * - Setting up the Confidence provider with default settings
 * - Evaluating flags with sticky assignments
 * - How the provider automatically handles materializations via remote API
 */

async function main() {
  console.log('🚀 Starting Basic Confidence OpenFeature Example\n');

  // Create provider with default RemoteResolverFallback strategy
  // The provider will automatically fall back to the remote API when
  // materializations are missing
  const provider = createConfidenceServerProvider({
    flagClientSecret: process.env.CONFIDENCE_CLIENT_SECRET || 'test.clientSecret',
    apiClientId: process.env.CONFIDENCE_API_CLIENT_ID || 'test-api-client-id',
    apiClientSecret: process.env.CONFIDENCE_API_CLIENT_SECRET || 'test-api-client-secret',
    // stickyResolveStrategy is automatically set to RemoteResolverFallback
  });
  // Set the provider
  try { 
    console.log('Initializing provider...');
    await OpenFeature.setProviderAndWait(provider);
  console.log('✅ Provider initialized\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  // Get a client
  const client = OpenFeature.getClient();

  // Evaluate the flag from the Java demo
  console.log('📋 Evaluating flag: nicklas-java-flag.enabled\n');

  const details = await client.getBooleanDetails(
    'nicklas-java-flag.enabled',
    false,
    {
      targetingKey: 'user-123',
      user_id: 'user-123',
      registration_country: 'SE'
    }
  );

  console.log(`  Value: ${details.value}`);
  console.log(`  Variant: ${details.variant || 'N/A'}`);
  console.log(`  Reason: ${details.reason}\n`);

  // Cleanup
  console.log('🧹 Cleaning up...');
  await OpenFeature.close();
  console.log('✅ Done!\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
