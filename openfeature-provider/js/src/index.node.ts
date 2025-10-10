import fs from 'node:fs/promises'
import { ConfidenceServerProviderLocal, ProviderOptions } from './ConfidenceServerProviderLocal';
import { WasmResolver } from './WasmResolver';

const wasmPath = require.resolve('./confidence_resolver.wasm');
const buffer = await fs.readFile(wasmPath);

const module = await WebAssembly.compile(buffer as BufferSource);
const resolver = await WasmResolver.load(module);

export function createConfidenceServerProvider(options:ProviderOptions):ConfidenceServerProviderLocal {
  return new ConfidenceServerProviderLocal(resolver, options)
}

// Re-export sticky resolve strategy interfaces for users to implement
export type {
  StickyResolveStrategy,
  MaterializationRepository,
  ResolverFallback
} from './StickyResolveStrategy';

// Re-export RemoteResolverFallback implementation
export { RemoteResolverFallback } from './RemoteResolverFallback';
export type { RemoteResolverFallbackOptions } from './RemoteResolverFallback';

// Re-export proto types that users may need
export type {
  MaterializationInfo,
  ResolveFlagsRequest,
  ResolveFlagsResponse
} from './proto/api';