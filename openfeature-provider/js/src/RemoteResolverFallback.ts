import type { ResolverFallback } from './StickyResolveStrategy';
import type { ResolveFlagsRequest, ResolveFlagsResponse } from './proto/api';
import { ResolveFlagsRequest as ResolveFlagsRequestCodec, ResolveFlagsResponse as ResolveFlagsResponseCodec } from './proto/api';

export interface RemoteResolverFallbackOptions {
  /**
   * Base URL for the Confidence resolver API.
   * @default 'https://resolver.confidence.dev/v1'
   */
  baseUrl?: string;

  /**
   * Fetch implementation to use for HTTP requests.
   * @default globalThis.fetch
   */
  fetch?: typeof fetch;
}

/**
 * Default implementation of ResolverFallback that delegates to the remote Confidence API.
 *
 * This strategy is used when the local WASM resolver is missing materialization data
 * and needs to fall back to the server for resolution. The remote API handles
 * materialization storage with a 90-day TTL.
 *
 * @example
 * ```typescript
 * const fallback = new RemoteResolverFallback({
 *   baseUrl: 'https://resolver.confidence.dev/v1'
 * });
 *
 * const provider = createConfidenceServerProvider({
 *   flagClientSecret: 'client-secret',
 *   apiClientId: 'api-id',
 *   apiClientSecret: 'api-secret',
 *   stickyResolveStrategy: fallback
 * });
 * ```
 */
export class RemoteResolverFallback implements ResolverFallback {
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: RemoteResolverFallbackOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'https://resolver.confidence.dev/v1';
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
  }

  async resolve(request: ResolveFlagsRequest): Promise<ResolveFlagsResponse> {
    const resp = await this.fetchImplementation(`${this.baseUrl}/flags:resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ResolveFlagsRequestCodec.toJSON(request)),
    });

    if (!resp.ok) {
      throw new Error(`Remote resolve failed: ${resp.status} ${resp.statusText}`);
    }

    const json = await resp.json();
    return ResolveFlagsResponseCodec.fromJSON(json);
  }

  close(): void {
    // No resources to clean up
  }
}
