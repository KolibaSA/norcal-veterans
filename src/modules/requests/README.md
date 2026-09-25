# Requests

September 24, 2026: the scheduled agent is retired. HQ Requests and all stored history remain for manual tracking. The CLI entry refuses execution; Node policy/transport files are retained as recovery and regression references, not an active service. With `processorConnected=false`, browser agent-health UI/polling is disabled and the editor describes manual tracking.

Owns platform-owner and Super Admin work instructions, exact-revision approvals, execution locking, comments, immutable runs/results, reconciliation and Agent Health. Owned data: `records(kind=request)`, `request_runs`, `request_entries`, `hq_agent_health`, related audit and revisions; the Node adapter also owns ignored local claims.

- `server.mjs`: `handleRequestRoute(req, env, user)` handles `/api/hq/requests/:id/{history,comments,reconcile}` and `/api/hq/agent-health`; returns a Response or null. Identity must already be verified. Platform-admin privilege, same-origin writes and bounded JSON are enforced here.
- `domain.mjs`: the record contract, platform-admin authorization, in-progress lock, atomic update guard and exact next-version approval. `stripEditorCredentials(payload)` strips client execution fields; `redactPayload(payload)` strips approval/token fields for display while retaining visible run state. Both operate on a decoded copy supplied by callers. These supported security interfaces also protect other record kinds and history views.
- `domain-agent.mjs`: `createAgentPolicy({hash})` owns pinned-target checks, SQL transitions, state inspection and health SQL. It contains no Node imports; the hash function is injected.
- `node.mjs`: local lock/claim durability, report files, Wrangler transport and CLI parsing. `scripts/norcal-hq-agent.mjs` retains the same CLI and exports. The Worker and browser never import this adapter.

Run `npm run test:module -- requests`. The module owns the existing synthetic SQLite runner/recovery suite in `node.test.mjs` and direct security checks in `server.test.mjs`. `scripts/norcal-api.test.mjs` covers authenticated save/claim races and request history integration. Do not run the live helper to test a code refactor. Super Admin eligibility uses current `grants` for both the creator and approval actor; exact-version approval remains mandatory. Revocation blocks pending claims and active resume/finish; a remaining platform admin can reconcile without replaying work. Reconciliation/history are available for any request, including one whose creator lost access. No claim paths or target IDs changed.

`domain.mjs` exports `recordDefinition` (record kind, allowed statuses and `validate(input, options)`). `src/app/record-definitions.mjs` registers it and supplies mandatory credential sanitization; `src/app/hq-records.mjs` preserves `/api/hq/records` and `/api/hq/records/:id`. There is no feature-specific query hidden in that dispatcher.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
