# Confidence OpenFeature Provider Examples

This directory contains example applications demonstrating how to use the Confidence OpenFeature provider with sticky resolve functionality.

## Prerequisites

- Node.js 18+
- Confidence account with API credentials (for production use)

## Setup

Install dependencies:

```bash
cd examples
npm install
```

## Examples

### 1. Basic Usage (`basic-usage.ts`)

Demonstrates the default setup using `RemoteResolverFallback`.

**What it shows:**
- Setting up the provider with minimal configuration
- Evaluating a boolean flag
- Sticky assignments - same user gets same variant even with different context
- Default remote fallback strategy

**Run:**
```bash
npm run basic
```

**Environment variables:**
```bash
export CONFIDENCE_CLIENT_SECRET="your-client-secret"
export CONFIDENCE_API_CLIENT_ID="your-api-client-id"
export CONFIDENCE_API_CLIENT_SECRET="your-api-client-secret"
npm run basic
```

### 2. File-Backed Repository (`file-backed-example.ts`)

Demonstrates persistent storage using a file-backed repository.

**What it shows:**
- Custom `MaterializationRepository` implementation (file-backed)
- Persistent storage in `materialization-cache.json`
- Assignments survive application restarts
- Cache hits when re-running the example
- Simple JSON file storage for development/testing

**Run:**
```bash
npm run file-backed
```

**Try running it twice to see cached data loaded from disk!**

**Environment variables:**
```bash
export CONFIDENCE_CLIENT_SECRET="your-client-secret"
export CONFIDENCE_API_CLIENT_ID="your-api-client-id"
export CONFIDENCE_API_CLIENT_SECRET="your-api-client-secret"
npm run file-backed
```

### 3. Performance Benchmark (`benchmark.ts`)

High-performance benchmark with random users and countries, inspired by the Java SDK demo.

**What it shows:**
- Custom `MaterializationRepository` implementation (in-memory)
- High-volume flag evaluations (default 500 resolves)
- Performance metrics and throughput
- Cache hit rates
- Repository statistics
- Random user distribution (10 users)
- Random European country distribution

**Run:**
```bash
npm run benchmark
```

**With custom repeat count:**
```bash
BENCHMARK_REPEATS=1000 npm run benchmark
```

**Environment variables:**
```bash
export CONFIDENCE_CLIENT_SECRET="your-client-secret"
export CONFIDENCE_API_CLIENT_ID="your-api-client-id"
export CONFIDENCE_API_CLIENT_SECRET="your-api-client-secret"
export BENCHMARK_REPEATS=1000  # Optional, defaults to 500
npm run benchmark
```

## How Sticky Resolve Works

### Remote Fallback (Default)

```typescript
const provider = createConfidenceServerProvider({
  flagClientSecret: 'client-secret',
  apiClientId: 'api-id',
  apiClientSecret: 'api-secret'
  // RemoteResolverFallback is used by default
});
```

When materializations are missing:
1. Local WASM resolver attempts to resolve
2. If materializations missing, falls back to remote API
3. Remote API handles storage with 90-day TTL
4. Simple setup, no local storage needed

### Custom Repository

The SDK provides two example repository implementations:

#### `InMemoryMaterializationRepo` (see `InMemoryMaterializationRepo.ts`)
- Stores materializations in memory (Map)
- Fast, no I/O overhead
- Data lost on application restart
- Best for: benchmarking, testing, short-lived processes

#### `FileBackedMaterializationRepo` (see `FileBackedMaterializationRepo.ts`)
- Stores all materializations in a single JSON file
- Data persists across application restarts
- Simple implementation for development/testing
- Best for: local development, simple deployments

**Creating your own repository:**

```typescript
import { MaterializationRepository, MaterializationInfo } from '@confidence/openfeature-provider';

class MyRepository implements MaterializationRepository {
  async loadMaterializedAssignmentsForUnit(
    unit: string,
    materialization: string
  ): Promise<Map<string, MaterializationInfo>> {
    // Load materializations for this unit from your storage
    // Return only the requested materialization if found, or empty map if not
    const data = await this.db.get(`unit:${unit}`);
    if (data && data[materialization]) {
      return new Map([[materialization, data[materialization]]]);
    }
    return new Map([[materialization, { unitInInfo: false, ruleToVariant: {} }]]);
  }

  async storeAssignment(
    unit: string,
    assignments: Map<string, MaterializationInfo>
  ): Promise<void> {
    // Store/merge materializations for this unit
    // This is called asynchronously (fire-and-forget)
    const existing = await this.db.get(`unit:${unit}`) || {};
    for (const [key, value] of assignments) {
      existing[key] = value;
    }
    await this.db.set(`unit:${unit}`, existing);
  }

  close(): void {
    // Cleanup resources
    this.db.disconnect();
  }
}

const provider = createConfidenceServerProvider({
  flagClientSecret: 'client-secret',
  apiClientId: 'api-id',
  apiClientSecret: 'api-secret',
  materializationRepository: new MyRepository()
});
```

**Benefits:**
- Full control over storage (TTL, persistence, etc.)
- No network calls to Confidence for materializations
- Can use existing infrastructure (Redis, DB, etc.)
- Data persists across restarts

## Key Concepts

### Targeting Key (Unit)
The `targetingKey` in the evaluation context identifies the randomization unit (typically a user ID):

```typescript
await client.getStringValue('my-flag', 'default', {
  targetingKey: 'user-123',  // This user will get consistent assignments
  region: 'us-west'
});
```

### Sticky Assignments
Once a user is assigned to a variant, they stay in that variant even if:
- Their context attributes change
- Flag configuration is updated
- New assignments are paused

### Materialization
A materialization represents a specific experiment or rollout. The system stores which variant each user should receive for each materialization.

## Real-World Usage Examples

### Redis Repository

```typescript
import { createClient } from 'redis';

class RedisMaterializationRepository implements MaterializationRepository {
  constructor(private redis: ReturnType<typeof createClient>) {}

  async loadMaterializedAssignmentsForUnit(unit: string, materialization: string) {
    const data = await this.redis.get(`materializations:${unit}`);
    if (!data) return new Map();
    return new Map(Object.entries(JSON.parse(data)));
  }

  async storeAssignment(unit: string, assignments: Map<string, MaterializationInfo>) {
    await this.redis.set(
      `materializations:${unit}`,
      JSON.stringify(Object.fromEntries(assignments)),
      { EX: 60 * 60 * 24 * 90 } // 90 day TTL
    );
  }

  close() {
    this.redis.disconnect();
  }
}

const redis = createClient({ url: 'redis://localhost:6379' });
await redis.connect();

const provider = createConfidenceServerProvider({
  flagClientSecret: process.env.CONFIDENCE_CLIENT_SECRET!,
  apiClientId: process.env.CONFIDENCE_API_CLIENT_ID!,
  apiClientSecret: process.env.CONFIDENCE_API_CLIENT_SECRET!,
  materializationRepository: new RedisMaterializationRepository(redis)
});
```

### PostgreSQL Repository

```typescript
import { Pool } from 'pg';

class PostgresMaterializationRepository implements MaterializationRepository {
  constructor(private pool: Pool) {}

  async loadMaterializedAssignmentsForUnit(unit: string, materialization: string) {
    const result = await this.pool.query(
      'SELECT materialization_id, unit_in_info, rule_to_variant FROM materializations WHERE unit = $1',
      [unit]
    );

    const map = new Map();
    for (const row of result.rows) {
      map.set(row.materialization_id, {
        unitInInfo: row.unit_in_info,
        ruleToVariant: row.rule_to_variant
      });
    }
    return map;
  }

  async storeAssignment(unit: string, assignments: Map<string, MaterializationInfo>) {
    for (const [materializationId, info] of assignments) {
      await this.pool.query(
        `INSERT INTO materializations (unit, materialization_id, unit_in_info, rule_to_variant)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (unit, materialization_id)
         DO UPDATE SET unit_in_info = $3, rule_to_variant = $4`,
        [unit, materializationId, info.unitInInfo, info.ruleToVariant]
      );
    }
  }

  async close() {
    await this.pool.end();
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const provider = createConfidenceServerProvider({
  flagClientSecret: process.env.CONFIDENCE_CLIENT_SECRET!,
  apiClientId: process.env.CONFIDENCE_API_CLIENT_ID!,
  apiClientSecret: process.env.CONFIDENCE_API_CLIENT_SECRET!,
  materializationRepository: new PostgresMaterializationRepository(pool)
});
```

## Troubleshooting

### No flags resolving
- Check your `flagClientSecret`, `apiClientId`, and `apiClientSecret`
- Ensure your flags are published in Confidence
- Check network connectivity to `resolver.confidence.dev`

### Sticky assignments not working
- Ensure you're using the same `targetingKey` for the same user
- Check that your repository is loading/storing correctly (enable logging)
- Verify materializations are being stored (inspect storage)

### Performance issues
- Use `MaterializationRepository` with local storage (Redis, etc.) to avoid network calls
- Ensure your storage implementation is fast
- Consider connection pooling for database repositories

## Learn More

- [Confidence Documentation](https://confidence.spotify.com/docs)
- [OpenFeature Documentation](https://openfeature.dev/docs)
- [Sticky Resolve Strategy Interface](../src/StickyResolveStrategy.ts)
