import { ConfidenceServerProviderLocal, ProviderOptions } from './ConfidenceServerProviderLocal';
import { WasmResolver } from './WasmResolver';

const wasmUrl = new URL('confidence_resolver.wasm', import.meta.url);

const module = await WebAssembly.compileStreaming(fetch(wasmUrl));
const resolver = await WasmResolver.load(module);

export function createConfidenceServerProvider(options:ProviderOptions):ConfidenceServerProviderLocal {
  return new ConfidenceServerProviderLocal(resolver, options)
}

// Re-export sticky resolve strategy interfaces for users to implement
export type {
  StickyResolveStrategy,
  MaterializationRepository
} from './StickyResolveStrategy';

// Re-export RemoteResolverFallback implementation
export { RemoteResolverFallback } from './RemoteResolverFallback';
export type { RemoteResolverFallbackOptions } from './RemoteResolverFallback';

// Re-export proto types that users may need
export type {
  MaterializationInfo
} from './proto/api';