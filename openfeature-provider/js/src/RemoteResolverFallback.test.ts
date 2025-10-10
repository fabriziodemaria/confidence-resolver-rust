import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoteResolverFallback } from './RemoteResolverFallback';
import type { ResolveFlagsRequest, ResolveFlagsResponse } from './proto/api';
import { ResolveReason } from './proto/api';

describe('RemoteResolverFallback', () => {
  const RESOLVE_REASON_MATCH = ResolveReason.RESOLVE_REASON_MATCH;

  const mockRequest: ResolveFlagsRequest = {
    flags: ['flags/test-flag'],
    evaluationContext: { targetingKey: 'user-123' },
    clientSecret: 'client-secret',
    apply: true
  };

  const mockResponse: ResolveFlagsResponse = {
    resolvedFlags: [{
      flag: 'test-flag',
      variant: 'variant-a',
      value: { color: 'blue' },
      reason: RESOLVE_REASON_MATCH
    }],
    resolveToken: new Uint8Array(),
    resolveId: 'resolve-123'
  };

  describe('constructor', () => {
    it('should use default baseUrl when not provided', () => {
      const fallback = new RemoteResolverFallback();
      expect(fallback).toBeDefined();
    });

    it('should use custom baseUrl when provided', () => {
      const fallback = new RemoteResolverFallback({
        baseUrl: 'https://custom.example.com/v1'
      });
      expect(fallback).toBeDefined();
    });

    it('should use custom fetch implementation when provided', () => {
      const customFetch = vi.fn();
      const fallback = new RemoteResolverFallback({
        fetch: customFetch as any
      });
      expect(fallback).toBeDefined();
    });
  });

  describe('resolve', () => {
    let mockFetch: ReturnType<typeof vi.fn>;
    let fallback: RemoteResolverFallback;

    beforeEach(() => {
      mockFetch = vi.fn();
      fallback = new RemoteResolverFallback({
        fetch: mockFetch as any
      });
    });

    it('should make POST request to correct endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          resolvedFlags: mockResponse.resolvedFlags,
          resolveToken: '',
          resolveId: mockResponse.resolveId
        })
      });

      await fallback.resolve(mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://resolver.confidence.dev/v1/flags:resolve',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should send correct request body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          resolvedFlags: mockResponse.resolvedFlags,
          resolveToken: '',
          resolveId: mockResponse.resolveId
        })
      });

      await fallback.resolve(mockRequest);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({
        flags: ['flags/test-flag'],
        evaluationContext: { targetingKey: 'user-123' },
        clientSecret: 'client-secret',
        apply: true
      });
    });

    it('should return parsed response on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          resolvedFlags: [{
            flag: 'test-flag',
            variant: 'variant-a',
            value: { color: 'blue' },
            reason: 'RESOLVE_REASON_MATCH'
          }],
          resolveToken: '',
          resolveId: 'resolve-123'
        })
      });

      const result = await fallback.resolve(mockRequest);

      expect(result.resolvedFlags).toHaveLength(1);
      expect(result.resolvedFlags[0]).toEqual({
        flag: 'test-flag',
        variant: 'variant-a',
        value: { color: 'blue' },
        reason: RESOLVE_REASON_MATCH
      });
      expect(result.resolveId).toBe('resolve-123');
    });

    it('should throw error when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(fallback.resolve(mockRequest)).rejects.toThrow(
        'Remote resolve failed: 404 Not Found'
      );
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(fallback.resolve(mockRequest)).rejects.toThrow('Network error');
    });

    it('should use custom baseUrl when provided', async () => {
      const customFallback = new RemoteResolverFallback({
        baseUrl: 'https://custom.example.com/v2',
        fetch: mockFetch as any
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          resolvedFlags: [],
          resolveToken: '',
          resolveId: 'test'
        })
      });

      await customFallback.resolve(mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.example.com/v2/flags:resolve',
        expect.any(Object)
      );
    });

    it('should handle empty flags array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          resolvedFlags: [],
          resolveToken: '',
          resolveId: 'resolve-456'
        })
      });

      const result = await fallback.resolve({
        ...mockRequest,
        flags: []
      });

      expect(result.resolvedFlags).toEqual([]);
      expect(result.resolveId).toBe('resolve-456');
    });

    it('should handle multiple resolved flags', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          resolvedFlags: [
            {
              flag: 'flag-1',
              variant: 'variant-a',
              value: { setting: 'value1' },
              reason: 'RESOLVE_REASON_MATCH'
            },
            {
              flag: 'flag-2',
              variant: 'variant-b',
              value: { setting: 'value2' },
              reason: 'RESOLVE_REASON_MATCH'
            }
          ],
          resolveToken: '',
          resolveId: 'resolve-multi'
        })
      });

      const result = await fallback.resolve(mockRequest);

      expect(result.resolvedFlags).toHaveLength(2);
      expect(result.resolvedFlags[0].flag).toBe('flag-1');
      expect(result.resolvedFlags[1].flag).toBe('flag-2');
    });

    it('should preserve evaluation context', async () => {
      const contextRequest = {
        ...mockRequest,
        evaluationContext: {
          targetingKey: 'user-123',
          country: 'US',
          version: '1.0.0'
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          resolvedFlags: [],
          resolveToken: '',
          resolveId: 'test'
        })
      });

      await fallback.resolve(contextRequest);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.evaluationContext).toEqual({
        targetingKey: 'user-123',
        country: 'US',
        version: '1.0.0'
      });
    });
  });

  describe('close', () => {
    it('should not throw when called', () => {
      const fallback = new RemoteResolverFallback();
      expect(() => fallback.close()).not.toThrow();
    });

    it('should be callable multiple times', () => {
      const fallback = new RemoteResolverFallback();
      fallback.close();
      fallback.close();
      expect(() => fallback.close()).not.toThrow();
    });
  });

  describe('integration with type guards', () => {
    it('should be recognized as ResolverFallback', async () => {
      const { isResolverFallback } = await import('./StickyResolveStrategy');
      const fallback = new RemoteResolverFallback();

      expect(isResolverFallback(fallback)).toBe(true);
    });

    it('should not be recognized as MaterializationRepository', async () => {
      const { isMaterializationRepository } = await import('./StickyResolveStrategy');
      const fallback = new RemoteResolverFallback();

      expect(isMaterializationRepository(fallback)).toBe(false);
    });
  });
});
