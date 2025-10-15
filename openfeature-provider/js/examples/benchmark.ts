import 'dotenv/config';
import { OpenFeature } from '@openfeature/server-sdk';
import { createConfidenceServerProvider } from '../dist/index.node.js';
import { InMemoryMaterializationRepo } from './InMemoryMaterializationRepo.js';
import { FileBackedMaterializationRepo } from './FileBackedMaterializationRepo.js';

/**
 * Performance benchmark example.
 *
 * This example demonstrates:
 * - High-volume flag evaluations with sticky assignments
 * - Performance with in-memory repository
 * - Random user and country distribution
 * - Measuring resolve times
 */

const EUROPEAN_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'NO', 'CH',
  'UA'
];

/**
 * Load configuration from environment variables.
 */
function loadConfig() {
  return {
    clientSecret: process.env.CONFIDENCE_CLIENT_SECRET || 'test.clientSecret',
    apiClientId: process.env.CONFIDENCE_API_CLIENT_ID || 'test-api-client-id',
    apiClientSecret: process.env.CONFIDENCE_API_CLIENT_SECRET || 'test-api-client-secret',
  };
}

/**
 * Initialize the provider with configuration.
 */
async function init() {
  console.log('🚀 Initializing Confidence benchmark...\n');

  const config = loadConfig();
  const inMemoryRepository = new InMemoryMaterializationRepo();
  const fileBackedRepository = new FileBackedMaterializationRepo('./materialization-cache.json'); // can be used instead of inMemoryRepository

  const startTime = performance.now();

  const provider = createConfidenceServerProvider({
    flagClientSecret: config.clientSecret,
    apiClientId: config.apiClientId,
    apiClientSecret: config.apiClientSecret,
    materializationRepository: inMemoryRepository,
  });

  await OpenFeature.setProviderAndWait(provider);

  const initTime = performance.now() - startTime;
  console.log(`✅ Provider initialized in ${(initTime / 1000).toFixed(2)}s\n`);
  return inMemoryRepository;
}

/**
 * Resolve a flag for a user.
 */
async function resolve(userId: string, countryCode: string) {
  const client = OpenFeature.getClient();

  const context = {
    targetingKey: userId,
    user_id: userId,
    registration_country: countryCode,
  };

  const details = await client.getBooleanDetails(
    'nicklas-java-flag.enabled',
    false,
    context
  );

  // Uncomment to see detailed evaluation results
  // console.log(
  //   `Value: ${details.value}, Variant: ${details.variant}, Reason: ${details.reason}`
  // );

  return details;
}

/**
 * Run benchmark with random users and countries.
 */
async function runBenchmark(repeats: number) {
  console.log(`📊 Running benchmark with ${repeats} resolves...\n`);

  const startTime = performance.now();
  const results = new Map<boolean, number>();

  for (let i = 0; i < repeats; i++) {
    const randomUserId = `user-${Math.floor(Math.random() * 10) + 1}`; // user-1 to user-10
    const randomCountry = EUROPEAN_COUNTRIES[Math.floor(Math.random() * EUROPEAN_COUNTRIES.length)];

    const details = await resolve(randomUserId, randomCountry);

    // Track results
    results.set(details.value, (results.get(details.value) || 0) + 1);

    // Progress indicator
    if ((i + 1) % 100 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/${repeats}`);
    }
  }

  const totalTime = performance.now() - startTime;

  console.log('\n');
  console.log(`✅ Resolved ${repeats} times in ${totalTime.toFixed(2)}ms`);
  console.log(`   Average: ${(totalTime / repeats).toFixed(2)}ms per resolve`);
  console.log(`   Throughput: ${((repeats / totalTime) * 1000).toFixed(0)} resolves/second\n`);

  console.log('📈 Results distribution:');
  for (const [value, count] of results) {
    const percentage = ((count / repeats) * 100).toFixed(1);
    console.log(`   ${value}: ${count} (${percentage}%)`);
  }
  console.log();
}

/**
 * Main entry point.
 */
async function main() {
  const repository = await init();

  // Configuration
  const repeats = parseInt(process.env.BENCHMARK_REPEATS || '500', 10);

  // Run benchmark
  await runBenchmark(repeats);

  // Show repository stats
  const stats = repository.getStats();
  console.log('💾 Repository Statistics:');
  if ('units' in stats) {
    console.log(`   Unique units stored: ${stats.units}`);
  }
  console.log(`   Load operations: ${stats.loads}`);
  console.log(`   Store operations: ${stats.stores}`);
  console.log(`   Cache hits: ${stats.cacheHits}`);
  console.log(`   Cache misses: ${stats.cacheMisses}`);
  console.log(`   Cache hit rate: ${((stats.cacheHits / stats.loads) * 100).toFixed(1)}%\n`);

  // Cleanup
  console.log('🧹 Shutting down...');
  await OpenFeature.close();
  console.log('✅ Done!\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
