## @spotify-confidence/openfeature-server-provider-local

OpenFeature provider for the Spotify Confidence resolver (local mode, powered by WebAssembly). It periodically fetches resolver state, evaluates flags locally, and flushes evaluation logs to the Confidence backend.

### Features
- Local flag evaluation via WASM (no per-eval network calls)
- Automatic state refresh and batched flag log flushing
- Pluggable `fetch` with retries, timeouts and routing
- Optional logging using `debug`

### Requirements
- Node.js 18+ (built-in `fetch`) or provide a compatible `fetch`
- WebAssembly support (Node 18+/modern browsers)

---

## Installation

```bash
yarn add @spotify-confidence/openfeature-server-provider-local

# Optional: enable logs by installing the peer dependency
yarn add debug
```

Notes:
- `debug` is an optional peer. Install it if you want logs. Without it, logging is a no-op.
- Types and bundling are ESM-first; Node is supported, and a browser build is provided for modern bundlers.

---

## Quick start (Node)

```ts
import { OpenFeature } from '@openfeature/server-sdk';
import { createConfidenceServerProvider } from '@spotify-confidence/openfeature-server-provider-local';

const provider = createConfidenceServerProvider({
  flagClientSecret: process.env.CONFIDENCE_FLAG_CLIENT_SECRET!,
  apiClientId: process.env.CONFIDENCE_API_CLIENT_ID!,
  apiClientSecret: process.env.CONFIDENCE_API_CLIENT_SECRET!,
  // initializeTimeout?: number
  // flushInterval?: number
  // fetch?: typeof fetch (Node <18 or custom transport)
});

// Wait for the provider to be ready (fetches initial resolver state)
await OpenFeature.setProviderAndWait(provider);

const client = OpenFeature.getClient();

// Evaluate a boolean flag
const details = await client.getBooleanDetails('my-flag', false, { targetingKey: 'user-123' });
console.log(details.value, details.reason);

// Evaluate a nested value from an object flag using dot-path
// e.g. flag key "experiments" with payload { groupA: { ratio: 0.5 } }
const ratio = await client.getNumberValue('experiments.groupA.ratio', 0, { targetingKey: 'user-123' });

// On shutdown, flush any pending logs
await provider.onClose();
```

---

## Options

- `flagClientSecret` (string, required): The flag client secret used during evaluation.
- `apiClientId` (string, required): OAuth client ID for Confidence IAM.
- `apiClientSecret` (string, required): OAuth client secret for Confidence IAM.
- `initializeTimeout` (number, optional): Max ms to wait for initial state fetch. Defaults to 30_000.
- `flushInterval` (number, optional): Interval in ms for sending evaluation logs. Defaults to 10_000.
- `fetch` (optional): Custom `fetch` implementation. Required for Node < 18; for Node 18+ you can omit.
- `materializationRepository` (optional): Custom storage for sticky assignments. See [Sticky Assignments](#sticky-assignments) below.

The provider periodically:
- Refreshes resolver state (default every 30s)
- Flushes flag evaluation logs to the backend

---

## Sticky Assignments

Confidence supports "sticky" flag assignments to ensure users receive consistent variant assignments even when their context changes or flag configurations are updated. 

### How it works

When a flag is evaluated for a user, Confidence creates a "materialization" - a snapshot of which variant that user was assigned. On subsequent evaluations, the same variant is returned even if:
- The user's context attributes change (e.g., different country, device type)
- The flag's targeting rules are modified
- New assignments are paused

### Default behavior (no repository)

If you don't provide a `materializationRepository`, the provider automatically falls back to resolve with our cloud resolvers:
- Materializations are stored on Confidence servers with a 90-day TTL
- No local storage or database setup required
- Best for most use cases

```ts
const provider = createConfidenceServerProvider({
  flagClientSecret: process.env.CONFIDENCE_FLAG_CLIENT_SECRET!,
  apiClientId: process.env.CONFIDENCE_API_CLIENT_ID!,
  apiClientSecret: process.env.CONFIDENCE_API_CLIENT_SECRET!,
  // materializationRepository is optional - uses remote storage by default
});
```

### Custom storage with MaterializationRepository

For advanced use cases where you want full control over materialization storage (e.g., Redis, database, file system), implement the `MaterializationRepository` interface:

```ts
interface MaterializationRepository {
  /**
   * Load ALL stored materialization assignments for a targeting unit.
   *
   * @param unit - The targeting key (e.g., user ID, session ID)
   * @param materialization - The materialization ID being requested (for context)
   * @returns Map of materialization ID to MaterializationInfo for this unit
   */
  loadMaterializedAssignmentsForUnit(
    unit: string,
    materialization: string
  ): Promise<Map<string, MaterializationInfo>>;

  /**
   * Store materialization assignments for a targeting unit.
   *
   * @param unit - The targeting key (e.g., user ID, session ID)
   * @param assignments - Map of materialization ID to MaterializationInfo
   */
  storeAssignment(
    unit: string,
    assignments: Map<string, MaterializationInfo>
  ): Promise<void>;

  /**
   * Close and cleanup any resources used by this repository.
   */
  close(): void | Promise<void>;
}
```

**Key points:**
- `loadMaterializedAssignmentsForUnit` should return ALL materializations for the given unit, not just the one requested
- This allows efficient bulk loading from your storage system
- The provider handles caching and coordination internally

See [MAT_REPO_EXAMPLES.md](./MAT_REPO_EXAMPLES.md) for complete implementation examples including:
- In-memory repository for testing
- File-backed repository for persistent storage

---

## Logging (optional)

Logging uses the `debug` library if present; otherwise, all log calls are no-ops.

Namespaces:
- Core: `cnfd:*`
- Fetch/middleware: `cnfd:fetch:*` (e.g. retries, auth renewals, request summaries)

Enable logs:

- Node:
```bash
DEBUG=cnfd:* node app.js
# or narrower
DEBUG=cnfd:info,cnfd:error,cnfd:fetch:* node app.js
```

- Browser (in DevTools console):
```js
localStorage.debug = 'cnfd:*';
```

Install `debug` if you haven’t:

```bash
yarn add debug
```

---

## WebAssembly asset notes

- Node: the WASM (`confidence_resolver.wasm`) is resolved from the installed package automatically; no extra config needed.
- Browser: the ESM build resolves the WASM via `new URL('confidence_resolver.wasm', import.meta.url)` so modern bundlers (Vite/Rollup/Webpack 5 asset modules) will include it. If your bundler does not, configure it to treat the `.wasm` file as a static asset.

---

## Using in browsers

The package exports a browser ESM build that compiles the WASM via streaming and uses the global `fetch`. Integrate it with your OpenFeature SDK variant for the web similarly to Node, then register the provider before evaluation. Credentials must be available to the runtime (e.g. through your app’s configuration layer).

---

## Testing

- You can inject a custom `fetch` via the `fetch` option to stub network behavior in tests.
- The provider batches logs; call `await provider.onClose()` in tests to flush them deterministically.

---

## Troubleshooting

- Provider stuck in NOT_READY/ERROR:
  - Verify `apiClientId`/`apiClientSecret` and `flagClientSecret` are correct.
  - Ensure outbound access to Confidence endpoints and GCS.
  - Enable `DEBUG=cnfd:*` for more detail.

- No logs appear:
  - Install `debug` and enable the appropriate namespaces.
  - Check that your environment variable/`localStorage.debug` is set before your app initializes the provider.

---

## License

See the root `LICENSE`.
