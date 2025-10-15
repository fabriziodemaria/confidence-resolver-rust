import 'dotenv/config';
import { OpenFeature } from '@openfeature/server-sdk';
import { createConfidenceServerProvider } from '../dist/index.node.js';
import { FileBackedMaterializationRepo } from './FileBackedMaterializationRepo.js';

/**
 * File-backed materialization repository example.
 *
 * This example demonstrates:
 * - Persistent storage of materializations to disk
 * - Assignments survive application restarts
 * - Each unit's data stored in separate JSON file
 */

async function main() {
  console.log('🚀 Starting File-Backed Repository Example\n');

  // Create file-backed repository
  const repository = new FileBackedMaterializationRepo('./materialization-cache.json');
  await repository.initialize();

  const provider = createConfidenceServerProvider({
    flagClientSecret: process.env.CONFIDENCE_CLIENT_SECRET || 'test.clientSecret',
    apiClientId: process.env.CONFIDENCE_API_CLIENT_ID || 'test-api-client-id',
    apiClientSecret: process.env.CONFIDENCE_API_CLIENT_SECRET || 'test-api-client-secret',
    materializationRepository: repository,
  });

  await OpenFeature.setProviderAndWait(provider);
  console.log('✅ Provider initialized with file-backed repository\n');

  const client = OpenFeature.getClient();

  // First evaluation
  console.log('📋 First Evaluation:');
  const result1 = await client.getBooleanDetails(
    'nicklas-java-flag.enabled',
    false,
    {
      targetingKey: 'user-123',
      user_id: 'user-123',
      registration_country: 'SE'
    }
  );
  console.log(`  Value: ${result1.value}`);
  console.log(`  Variant: ${result1.variant}`);
  console.log(`  Reason: ${result1.reason}\n`);

  // Second evaluation (should use cached data)
  console.log('📋 Second Evaluation (same user):');
  const result2 = await client.getBooleanDetails(
    'nicklas-java-flag.enabled',
    false,
    {
      targetingKey: 'user-123',
      user_id: 'user-123',
      registration_country: 'NO' // Different country
    }
  );
  console.log(`  Value: ${result2.value}`);
  console.log(`  Variant: ${result2.variant}`);
  console.log(`  Reason: ${result2.reason}`);
  console.log(`  Sticky: ${result1.value === result2.value ? '✅ Same value (sticky)' : '❌ Different value'}\n`);

  // Different user
  console.log('📋 Third Evaluation (different user):');
  const result3 = await client.getBooleanDetails(
    'nicklas-java-flag.enabled',
    false,
    {
      targetingKey: 'user-456',
      user_id: 'user-456',
      registration_country: 'SE'
    }
  );
  console.log(`  Value: ${result3.value}`);
  console.log(`  Variant: ${result3.variant}`);
  console.log(`  Reason: ${result3.reason}\n`);

  // Show stats
  const stats = repository.getStats();
  console.log('💾 Repository Statistics:');
  console.log(`   Load operations: ${stats.loads}`);
  console.log(`   Store operations: ${stats.stores}`);
  console.log(`   Cache hits: ${stats.cacheHits}`);
  console.log(`   Cache misses: ${stats.cacheMisses}`);
  console.log(`   Cache hit rate: ${((stats.cacheHits / stats.loads) * 100).toFixed(1)}%\n`);

  console.log('💡 Note: Materialization data is stored in materialization-cache.json');
  console.log('   Run this example again to see cached data loaded from disk!\n');

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
