import type { MaterializationRepository, MaterializationInfo } from '../dist/index.node.js';

/**
 * In-memory materialization repository for benchmarking.
 *
 * Matches Java implementation behavior:
 * - Returns only the requested materialization if found
 * - Returns empty MaterializationInfo if not found
 * - Merges new assignments with existing ones on store
 */
export class InMemoryMaterializationRepo implements MaterializationRepository {
  private storage = new Map<string, Map<string, MaterializationInfo>>();
  private loadCount = 0;
  private storeCount = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  /**
   * Helper method to create a map with a default, empty MaterializationInfo.
   */
  private createEmptyMap(key: string): Map<string, MaterializationInfo> {
    const emptyInfo: MaterializationInfo = {
      unitInInfo: false,
      ruleToVariant: {}
    };
    return new Map([[key, emptyInfo]]);
  }

  async loadMaterializedAssignmentsForUnit(
    unit: string,
    materialization: string
  ): Promise<Map<string, MaterializationInfo>> {
    this.loadCount++;

    const unitAssignments = this.storage.get(unit);

    if (unitAssignments) {
      if (unitAssignments.has(materialization)) {
        // Cache hit - return only the requested materialization
        const result = new Map<string, MaterializationInfo>();
        result.set(materialization, unitAssignments.get(materialization)!);
        this.cacheHits = (this.cacheHits || 0) + 1;
        return result;
      } else {
        // Materialization not found in cached data for unit
        this.cacheMisses = (this.cacheMisses || 0) + 1;
        return this.createEmptyMap(materialization);
      }
    }

    // Cache miss for the unit - return empty map structure
    this.cacheMisses = (this.cacheMisses || 0) + 1;
    return this.createEmptyMap(materialization);
  }

  async storeAssignment(
    unit: string,
    assignments: Map<string, MaterializationInfo>
  ): Promise<void> {
    this.storeCount++;

    if (!unit) {
      return;
    }

    // Atomic update: merge new assignments with existing ones
    const existingEntry = this.storage.get(unit);

    if (!existingEntry) {
      // No existing entry - create new one
      this.storage.set(unit, new Map(assignments));
    } else {
      // Merge new assignments into existing entry
      const newEntry = new Map(existingEntry);
      for (const [key, value] of assignments) {
        newEntry.set(key, value);
      }
      this.storage.set(unit, newEntry);
    }
  }

  close(): void {
    this.storage.clear();
  }

  getStats() {
    return {
      units: this.storage.size,
      loads: this.loadCount,
      stores: this.storeCount,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses
    };
  }

  /**
   * Export all stored data as a plain object for serialization.
   */
  exportData(): Record<string, Record<string, MaterializationInfo>> {
    const result: Record<string, Record<string, MaterializationInfo>> = {};

    for (const [unit, materializations] of this.storage.entries()) {
      result[unit] = {};
      for (const [key, value] of materializations.entries()) {
        result[unit][key] = value;
      }
    }

    return result;
  }
}
