import * as fs from 'fs/promises';
import type { MaterializationRepository, MaterializationInfo } from '../dist/index.node.js';
import { InMemoryMaterializationRepo } from './InMemoryMaterializationRepo.js';

/**
 * File-backed materialization repository.
 *
 * Reads from file on initialization, uses in-memory storage during runtime,
 * and writes back to file on close.
 * Data structure: { [unit: string]: { [materialization: string]: MaterializationInfo } }
 */
export class FileBackedMaterializationRepo implements MaterializationRepository {
  private readonly filePath: string;
  private readonly memoryRepo: InMemoryMaterializationRepo;

  constructor(filePath: string = './materialization-cache.json') {
    this.filePath = filePath;
    this.memoryRepo = new InMemoryMaterializationRepo();
  }

  /**
   * Initialize by loading data from file into memory.
   */
  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const allData: Record<string, Record<string, MaterializationInfo>> = JSON.parse(data);

      // Load all data into the in-memory repo
      for (const [unit, materializations] of Object.entries(allData)) {
        const assignments = new Map<string, MaterializationInfo>();
        for (const [key, value] of Object.entries(materializations)) {
          assignments.set(key, value);
        }
        await this.memoryRepo.storeAssignment(unit, assignments);
      }
    } catch {
      // File doesn't exist or is invalid, start with empty state
    }
  }

  async loadMaterializedAssignmentsForUnit(
    unit: string,
    materialization: string
  ): Promise<Map<string, MaterializationInfo>> {
    return this.memoryRepo.loadMaterializedAssignmentsForUnit(unit, materialization);
  }

  async storeAssignment(
    unit: string,
    assignments: Map<string, MaterializationInfo>
  ): Promise<void> {
    return this.memoryRepo.storeAssignment(unit, assignments);
  }

  async close(): Promise<void> {
    // Export in-memory data and write to file
    const allData = this.memoryRepo.exportData();
    await fs.writeFile(this.filePath, JSON.stringify(allData, null, 2), 'utf-8');
    this.memoryRepo.close();
  }

  getStats() {
    return this.memoryRepo.getStats();
  }
}
