import * as fs from 'fs/promises';
import type { MaterializationRepository, MaterializationInfo } from '../dist/index.node.js';

/**
 * File-backed materialization repository.
 *
 * Stores all materializations in a single JSON file for persistence across restarts.
 * Data structure: { [unit: string]: { [materialization: string]: MaterializationInfo } }
 */
export class FileBackedMaterializationRepo implements MaterializationRepository {
  private readonly filePath: string;
  private loadCount = 0;
  private storeCount = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(filePath: string = './materialization-cache.json') {
    this.filePath = filePath;
  }

  /**
   * Initialize the storage file if it doesn't exist.
   */
  async initialize(): Promise<void> {
    try {
      await fs.access(this.filePath);
    } catch {
      // File doesn't exist, create it with empty object
      await fs.writeFile(this.filePath, '{}', 'utf-8');
    }
  }

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

  /**
   * Read all data from the file.
   */
  private async readAllData(): Promise<Record<string, Record<string, MaterializationInfo>>> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  /**
   * Write all data to the file.
   */
  private async writeAllData(data: Record<string, Record<string, MaterializationInfo>>): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async loadMaterializedAssignmentsForUnit(
    unit: string,
    materialization: string
  ): Promise<Map<string, MaterializationInfo>> {
    this.loadCount++;

    const allData = await this.readAllData();
    const unitData = allData[unit];

    if (unitData && unitData[materialization]) {
      // Cache hit - return only the requested materialization
      const result = new Map<string, MaterializationInfo>();
      result.set(materialization, unitData[materialization]);
      this.cacheHits = (this.cacheHits || 0) + 1;
      return result;
    }

    // Cache miss
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

    // Read all data
    const allData = await this.readAllData();

    // Ensure unit exists
    if (!allData[unit]) {
      allData[unit] = {};
    }

    // Merge new assignments with existing ones for this unit
    for (const [key, value] of assignments) {
      allData[unit][key] = value;
    }

    // Write back all data
    await this.writeAllData(allData);
  }

  async close(): Promise<void> {
    // Optionally clean up cache file
    // await fs.rm(this.filePath, { force: true });
  }

  getStats() {
    return {
      loads: this.loadCount,
      stores: this.storeCount,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses
    };
  }
}
