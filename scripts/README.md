# Build and verification

Run from the repository root with the existing Node 24+ runtime and locked dependencies.

| Command | Purpose |
| --- | --- |
| `npm run test:module -- share-program` | Run only tests inside the named feature, including nested test files. |
| `npm run test:active` | Run the active NorCal integration tests and every feature/shared/application test. |
| `npm test` | Run all of those tests plus the preserved imported-application regression fixtures. |
| `npm run check:architecture` | Verify feature interfaces, cycles, shared independence, and runtime/Node separation. |
| `npm run build` | Generate all artifacts, check architecture, then run the complete test gate. |

The equivalent focused command is `node scripts/run-tests.mjs --module share-program`. An unknown module or a module without focused tests fails explicitly. Focused tests never select unrelated legacy suites; use the full gate when completing the refactor or changing shared contracts. Discovery includes `src/modules/**/*.test.mjs`, `src/shared/**/*.test.mjs`, `src/app/**/*.test.mjs`, and the existing script tests.

`build.mjs` bundles `worker/legacy/hq-client.mjs`, expands feature-owned HTML and CSS fragments, and generates `worker/legacy/hq-template.mjs`. Its CSP hash is computed from the exact script bytes embedded in the page. Do not edit the generated template. The template test also detects a stale generated artifact and imports the served bytes to verify that browser dependencies are resolved.

The existing `dist/worker.mjs` and `dist/hq-worker.mjs` remain regression fixtures for the imported application. Their existing runtime entry logic is bundled with explicit imports so compatibility facades and module-local helper names remain valid. This replaces the old import-stripping concatenation. The deployed entry is still `src/norcal-worker.mjs` under the existing Wrangler configuration.

Bundling uses esbuild 0.27.3 already pinned under Wrangler in `pnpm-lock.yaml`; `build-support.mjs` resolves that dependency through Wrangler, including pnpm's isolated layout. No dependency or framework was added. If the local sandbox blocks its subprocess, run the same authorized local verification with the normal approval mechanism.

`check-architecture.mjs` owns the supported interface names in `architecturePolicy.publicEntries`. Imports from outside a feature must use one of these root interfaces; implementation files remain private. Feature code cannot import application composition, and shared utilities cannot import features or application code. Dependency cycles touching modular code fail, including cycles routed through compatibility files. Preserved fixture-only cycles are excluded. Worker and browser entry graphs cannot reach Node builtins, Node adapters, or script helpers. Tests exercise invalid dependency graphs and prove that Share a Program bundles using only its feature and shared utilities.

These commands perform local generation and verification. Publishing uses the separate project deployment workflow.
