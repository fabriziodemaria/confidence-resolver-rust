import type {
  MaterializationInfo,
  ResolveFlagsRequest,
  ResolveFlagsResponse,
} from './proto/api';

/**
 * Base interface for sticky resolve strategies.
 *
 * Sticky resolve ensures users get consistent variant assignments even when:
 * - Their context attributes change
 * - Flag configurations are updated
 * - New assignments are paused
 */
export interface StickyResolveStrategy {
  /**
   * Close and cleanup any resources used by this strategy.
   */
  close(): void | Promise<void>;
}

/**
 * Strategy for storing and loading materialized assignments locally.
 *
 * Use this when you want to:
 * - Store assignments in a database, Redis, or other persistent storage
 * - Avoid network calls for materialization data
 * - Have full control over TTL and storage mechanism
 *
 * @example
 * ```typescript
 * class RedisMaterializationRepository implements MaterializationRepository {
 *   constructor(private redis: RedisClient) {}
 *
 *   async loadMaterializedAssignmentsForUnit(unit: string, materialization: string) {
 *     // Load ALL materializations for this unit
 *     const data = await this.redis.get(`unit:${unit}`);
 *     if (!data) {
 *       return new Map();
 *     }
 *     const parsed = JSON.parse(data);
 *     return new Map(Object.entries(parsed));
 *   }
 *
 *   async storeAssignment(unit: string, assignments: Map<string, MaterializationInfo>) {
 *     const serialized = JSON.stringify(Object.fromEntries(assignments));
 *     await this.redis.set(`unit:${unit}`, serialized, { EX: 60*60*24*90 });
 *   }
 *
 *   close(): void {
 *     this.redis.disconnect();
 *   }
 * }
 * ```
 */
export interface MaterializationRepository extends StickyResolveStrategy {
  /**
   * Load ALL stored materialization assignments for a targeting unit.
   *
   * This method loads all materialization data for the given unit at once,
   * not just a specific materialization. This allows efficient bulk loading
   * from storage.
   *
   * @param unit - The targeting key (e.g., user ID, session ID)
   * @param materialization - The materialization ID being requested (for context/filtering)
   * @returns Map of materialization ID to MaterializationInfo for this unit
   */
  loadMaterializedAssignmentsForUnit(
    unit: string,
    materialization: string
  ): Promise<Map<string, MaterializationInfo>>;

  /**
   * Store materialization assignments for a targeting unit.
   *
   * This stores all materialization info for the given unit. The map contains
   * materialization IDs as keys and their corresponding info as values.
   *
   * @param unit - The targeting key (e.g., user ID, session ID)
   * @param assignments - Map of materialization ID to MaterializationInfo
   */
  storeAssignment(
    unit: string,
    assignments: Map<string, MaterializationInfo>
  ): Promise<void>;
}

/**
 * Strategy for falling back to remote Confidence API when materializations are missing.
 *
 * Use this when you want to:
 * - Delegate to Confidence servers for missing materialization data
 * - Leverage 90-day automatic TTL on the server side
 * - Simplify implementation (no local storage needed)
 *
 * This is the default strategy and recommended for most use cases.
 *
 * @example
 * ```typescript
 * const strategy = new RemoteResolverFallback(fetch, {
 *   apiClientId: 'client-id',
 *   apiClientSecret: 'api-secret'
 * });
 * ```
 */
export interface ResolverFallback extends StickyResolveStrategy {
  /**
   * Resolve flags using the remote Confidence API.
   *
   * Called when the local resolver is missing materialization data.
   *
   * @param request - The resolve flags request
   * @returns Promise of resolved flags from remote
   */
  resolve(request: ResolveFlagsRequest): Promise<ResolveFlagsResponse>;
}

/**
 * Type guard to check if a strategy is a ResolverFallback.
 */
export function isResolverFallback(
  strategy: StickyResolveStrategy
): strategy is ResolverFallback {
  return 'resolve' in strategy && typeof (strategy as any).resolve === 'function';
}

/**
 * Type guard to check if a strategy is a MaterializationRepository.
 */
export function isMaterializationRepository(
  strategy: StickyResolveStrategy
): strategy is MaterializationRepository {
  return (
    'loadMaterializedAssignmentsForUnit' in strategy &&
    'storeAssignment' in strategy &&
    typeof (strategy as any).loadMaterializedAssignmentsForUnit === 'function' &&
    typeof (strategy as any).storeAssignment === 'function'
  );
}
