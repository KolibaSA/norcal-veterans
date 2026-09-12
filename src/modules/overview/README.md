# Overview

Owns the HQ home dashboard. It composes existing module browser interfaces and navigation, with no private data store, independent write API or server business policy. Identity and layout are supplied by the application shell.

Run `npm run test:module -- overview` and the synthetic browser startup checks.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
