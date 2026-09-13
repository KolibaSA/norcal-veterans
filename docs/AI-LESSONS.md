# NorCal Veterans — AI Lessons

Adopted September 13, 2026. Practical guidance, not doctrine. Read the current summary and relevant entries; current evidence and project requirements take precedence. No claim of measured time savings is implied.

## Project context

- Project: `KolibaSA/norcal-veterans`; public website and private HQ in one repository.
- [Working guide](AI-WORKING-GUIDE.md): review and log-maintenance convention.
- [Project instructions](../AGENTS.md), [background](../README.md), and [module map](../MODULES.md): authoritative starting context and feature ownership.
- [Deployment/recovery](norcal-deployment.md), [request agent](hq-request-agent.md), and [script interfaces](../scripts/README.md): operational procedures; reuse instead of duplicating them here.
- This file is repository documentation, not a public website asset. Keep credentials, private requests, exports, and personal data out of entries. It may be shared with repository readers.

## Current quick reference

1. **Reuse the verified Windows tool locations.** Distinguish missing command paths and blocked subprocesses from code failures. [L-20260913-01](#l-20260913-01)
2. **Test the real form submission, not only its visible selections or API handler.** Label local/staging/production evidence accurately. [L-20260913-02](#l-20260913-02)
3. **Use one primary release path.** The connected GitHub build already deploys; do not add a manual deployment by habit. [L-20260913-03](#l-20260913-03)

## Lessons

<a id="l-20260913-03"></a>
### L-20260913-03 — Avoid duplicate release paths

- Scope/tags: NorCal; GitHub main; Cloudflare deployment.
- Status: Verified observation; efficiency benefit not measured.
- Observation: The September 13 Super Admin release used both a push to deployment-connected main and a manual Wrangler deployment. Both paths can publish the same source and complicate identifying the final version.
- Evidence: Commit `a4a26e9`, its release execution, and the connected build documented in [README](../README.md#development-and-deployment).
- Next time: Prefer the configured connected build, verify its result, and use manual deployment only for a justified fallback or deliberately coordinated release.
- Limits: Recheck the actual build connection. Schema ordering, recovery, or service failure may require an explicit exception; do not change deployment configuration merely to follow this lesson.

<a id="l-20260913-02"></a>
### L-20260913-02 — Verify what the browser actually saves

- Scope/tags: HQ; browser forms; validation; permissions.
- Status: Verified.
- Observation: A displayed status selection did not prove the request form transmitted it. API-only checks can miss this kind of wiring error.
- Evidence: `c708f52` fixed the omitted status; [browser regression test](../src/shared/browser-runtime.test.mjs). During `a4a26e9`, Chrome synthetic QA verified Super Admin selection, save, and persistence after reload; signed Worker tests separately checked privilege boundaries.
- Next time: Test affected create/edit submissions and reopen the saved result; combine relevant browser and server checks.
- Limits: Synthetic signed-in QA does not establish signed-in production behavior. Preserve unsaved user text before any live reload.

<a id="l-20260913-01"></a>
### L-20260913-01 — Reuse host setup; diagnose environment failures

- Scope/tags: Current Windows Codex host; PowerShell; Node; Git; Wrangler.
- Status: Verified September 13, 2026; host-specific.
- Observation: The bundled Node executable worked, but an assumed adjacent `npm.cmd` did not exist. Git HTTPS helpers were under `mingw64/bin`, not the attempted `libexec/git-core`. Some build subprocesses required normal execution approval.
- Evidence: Super Admin release `a4a26e9`; Node rechecked as `v24.19.0` during guide adoption. Runtime root: `%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies`.
- Next time: Use `node\bin\node.exe` with PowerShell's `&`; when needed, point process-local `GIT_EXEC_PATH` to `native\git\mingw64\bin`. Keep `NODE_USE_SYSTEM_CA=1` for Wrangler. Follow the documented build stages with failure checks when npm is unavailable.
- Limits: Verify locations on a changed host/runtime. Request normal approval for restrictions; do not weaken certificate validation or assume approval carries across sessions.

## Maintenance

Use the entry template in the working guide. Record useful lessons, not a transcript or task checklist. Keep the quick reference small; merge duplicates and mark outdated advice superseded. Preserve archived evidence and concurrent edits. A completed task with nothing new to learn needs no entry. Updating this log does not authorize extra code changes, a deployment, or a change to the request agent.
