import type { ResolveFlagsRequest, ResolveFlagsResponse } from './proto/api';
import { ResolveFlagsRequest as ResolveFlagsRequestCodec, ResolveFlagsResponse as ResolveFlagsResponseCodec } from './proto/api';

export interface RemoteResolverFallbackOptions {
  /**
   * Fetch implementation to use for HTTP requests.
   * @default globalThis.fetch
   */
  fetch?: typeof fetch;
}

/**
 * Implementation that delegates to the remote Confidence API.
 *
 * This strategy is used when the local WASM resolver is missing materialization data
 * and needs to fall back to the server for resolution. The remote API handles
 * materialization storage with a 90-day TTL.
 *
 */
export class RemoteResolverFallback {
  private readonly url = 'https://resolver.confidence.dev/v1/flags:resolve';
  private readonly fetchImplementation: typeof fetch;

  constructor(options: RemoteResolverFallbackOptions = {}) {
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
  }

  async resolve(request: ResolveFlagsRequest): Promise<ResolveFlagsResponse> {
    const resp = await this.fetchImplementation(this.url, {
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
