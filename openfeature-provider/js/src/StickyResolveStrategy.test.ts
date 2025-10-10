import { describe, it, expect } from 'vitest';
import {
  isResolverFallback,
  isMaterializationRepository,
  type StickyResolveStrategy,
  type MaterializationRepository,
  type ResolverFallback,
} from './StickyResolveStrategy';
import type { ResolveFlagsRequest, ResolveFlagsResponse } from './proto/api';

describe('StickyResolveStrategy', () => {
  describe('Type Guards', () => {
    describe('isResolverFallback', () => {
      it('should return true for objects with resolve method', () => {
        const strategy: ResolverFallback = {
          async resolve(_request: ResolveFlagsRequest): Promise<ResolveFlagsResponse> {
            return {
              resolvedFlags: [],
              resolveToken: new Uint8Array(),
              resolveId: 'test',
            };
          },
          close: () => {},
        };

        expect(isResolverFallback(strategy)).toBe(true);
      });

      it('should return false for objects without resolve method', () => {
        const strategy: StickyResolveStrategy = {
          close: () => {},
        };

        expect(isResolverFallback(strategy)).toBe(false);
      });

      it('should return false for objects with resolve but not a function', () => {
        const strategy = {
          resolve: 'not a function',
          close: () => {},
        } as any;

        expect(isResolverFallback(strategy)).toBe(false);
      });

      it('should return false for MaterializationRepository', () => {
        const strategy: MaterializationRepository = {
          async loadMaterializedAssignmentsForUnit(
            _unit: string,
            _materialization: string
          ) {
            return new Map();
          },
          async storeAssignment(
            _unit: string,
            _assignments: Map<string, MaterializationInfo>
          ): Promise<void> {},
          close: () => {},
        };

        expect(isResolverFallback(strategy)).toBe(false);
      });
    });

    describe('isMaterializationRepository', () => {
      it('should return true for objects with loadMaterializedAssignmentsForUnit and storeAssignment methods', () => {
        const strategy: MaterializationRepository = {
          async loadMaterializedAssignmentsForUnit(
            _unit: string,
            _materialization: string
          ) {
            return new Map([
              ['mat-v1', {
                unitInInfo: true,
                ruleToVariant: { 'rule-1': 'variant-a' },
              }]
            ]);
          },
          async storeAssignment(
            _unit: string,
            _assignments: Map<string, MaterializationInfo>
          ): Promise<void> {},
          close: () => {},
        };

        expect(isMaterializationRepository(strategy)).toBe(true);
      });

      it('should return false for objects without loadMaterializedAssignmentsForUnit', () => {
        const strategy = {
          async storeAssignment(): Promise<void> {},
          close: () => {},
        } as any;

        expect(isMaterializationRepository(strategy)).toBe(false);
      });

      it('should return false for objects without storeAssignment', () => {
        const strategy = {
          async loadMaterializedAssignmentsForUnit(): Promise<MaterializationInfo | undefined> {
            return undefined;
          },
          close: () => {},
        } as any;

        expect(isMaterializationRepository(strategy)).toBe(false);
      });

      it('should return false for objects with properties but not functions', () => {
        const strategy = {
          loadMaterializedAssignmentsForUnit: 'not a function',
          storeAssignment: 'not a function',
          close: () => {},
        } as any;

        expect(isMaterializationRepository(strategy)).toBe(false);
      });

      it('should return false for ResolverFallback', () => {
        const strategy: ResolverFallback = {
          async resolve(_request: ResolveFlagsRequest): Promise<ResolveFlagsResponse> {
            return {
              resolvedFlags: [],
              resolveToken: new Uint8Array(),
              resolveId: 'test',
            };
          },
          close: () => {},
        };

        expect(isMaterializationRepository(strategy)).toBe(false);
      });
    });

    describe('Mutual Exclusivity', () => {
      it('should not be both ResolverFallback and MaterializationRepository', () => {
        const fallback: ResolverFallback = {
          async resolve(_request: ResolveFlagsRequest): Promise<ResolveFlagsResponse> {
            return {
              resolvedFlags: [],
              resolveToken: new Uint8Array(),
              resolveId: 'test',
            };
          },
          close: () => {},
        };

        const repository: MaterializationRepository = {
          async loadMaterializedAssignmentsForUnit(
            _unit: string,
            _materialization: string
          ) {
            return new Map();
          },
          async storeAssignment(
            _unit: string,
            _assignments: Map<string, MaterializationInfo>
          ): Promise<void> {},
          close: () => {},
        };

        // Fallback should not be a repository
        expect(isResolverFallback(fallback)).toBe(true);
        expect(isMaterializationRepository(fallback)).toBe(false);

        // Repository should not be a fallback
        expect(isMaterializationRepository(repository)).toBe(true);
        expect(isResolverFallback(repository)).toBe(false);
      });
    });
  });

  describe('Interface Contracts', () => {
    it('should allow implementing MaterializationRepository with sync close', () => {
      const strategy: MaterializationRepository = {
        async loadMaterializedAssignmentsForUnit(
          _unit: string,
          _materialization: string
        ): Promise<MaterializationInfo | undefined> {
          return {
            unitInInfo: true,
            ruleToVariant: {},
          };
        },
        async storeAssignment(
          _unit: string,
          _materialization: string,
          _rule: string,
          _variant: string
        ): Promise<void> {},
        close: () => {
          // Synchronous close
        },
      };

      expect(strategy).toBeDefined();
      expect(isMaterializationRepository(strategy)).toBe(true);
    });

    it('should allow implementing MaterializationRepository with async close', () => {
      const strategy: MaterializationRepository = {
        async loadMaterializedAssignmentsForUnit(
          _unit: string,
          _materialization: string
        ): Promise<MaterializationInfo | undefined> {
          return undefined;
        },
        async storeAssignment(
          _unit: string,
          _materialization: string,
          _rule: string,
          _variant: string
        ): Promise<void> {},
        close: async () => {
          // Async close
          await Promise.resolve();
        },
      };

      expect(strategy).toBeDefined();
      expect(isMaterializationRepository(strategy)).toBe(true);
    });

    it('should allow implementing ResolverFallback with sync close', () => {
      const strategy: ResolverFallback = {
        async resolve(_request: ResolveFlagsRequest): Promise<ResolveFlagsResponse> {
          return {
            resolvedFlags: [],
            resolveToken: new Uint8Array(),
            resolveId: 'test',
          };
        },
        close: () => {
          // Synchronous close
        },
      };

      expect(strategy).toBeDefined();
      expect(isResolverFallback(strategy)).toBe(true);
    });

    it('should allow implementing ResolverFallback with async close', () => {
      const strategy: ResolverFallback = {
        async resolve(_request: ResolveFlagsRequest): Promise<ResolveFlagsResponse> {
          return {
            resolvedFlags: [],
            resolveToken: new Uint8Array(),
            resolveId: 'test',
          };
        },
        close: async () => {
          // Async close
          await Promise.resolve();
        },
      };

      expect(strategy).toBeDefined();
      expect(isResolverFallback(strategy)).toBe(true);
    });
  });
});
