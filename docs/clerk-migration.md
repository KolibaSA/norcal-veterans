# Clerk migration — September 24, 2026

## Current state

The release configuration uses Clerk. The basic email-code flow passed in staging. Production migration 0006 and the live secret are prepared; the connected build and Access-route cutover are the remaining release actions. Exact deployment evidence is recorded privately under `.data/clerk-migration/`; do not infer completed live acceptance from configuration alone.

The dedicated NorCalVeterans Clerk development and production instances are created. Production DNS, TLS and email-domain verification completed. After production rejected paid MFA capabilities, the owner explicitly chose basic free features with no MFA on September 24, 2026. Both environments now use invitation-only email-code sign-in, immutable verified primary email, and no MFA. No plan upgrade or purchase is authorized. Existing server-side assignments and identity binding protections remain unchanged.

## Ownership and contracts

- `src/shared/clerk-auth.mjs`: official backend SDK verification, issuer/origin checks, pending-session/impersonation denial, live session/account checks, and stable identity binding.
- `src/shared/server-auth.mjs`: `HQ_AUTH_PROVIDER=clerk` selects Clerk; unset/`access` retains the existing verifier for rollback. Unknown providers fail closed.
- `src/shared/clerk-browser.mjs`, `clerk-pages.mjs`, and `src/app/clerk-page.mjs`: hosted Clerk UI on `/hq/sign-in`, `/hq/sign-up`, `/hq/sign-out`; public non-secret `/api/auth/config`; SDK refresh in authenticated HQ; narrowly scoped CSP.
- `worker/legacy/index.mjs`: route composition and request-local Clerk handshake/cookie forwarding. All protected endpoints still resolve fresh grants and enforce existing write-origin/scope rules.
- Access module: platform-admin-only `POST /api/hq/access/:id/invite`, only for an existing assignment. Invitations carry no authority metadata; duplicate invitations and rapid resends are handled. Existing role assignment and revocation remain separate from identity admission.

Migration `migrations/legacy/0006_clerk_identities.sql` is additive. It binds a verified assigned email to Clerk issuer + subject, with unique email and subject constraints. Recreated accounts cannot silently inherit an old binding. Existing grants, record IDs, audit actors and history are preserved. Any legitimate identity replacement needs an explicitly authorized, audited recovery procedure; do not delete bindings to bypass a mismatch.

Required runtime settings: `HQ_AUTH_PROVIDER`, `CLERK_PUBLISHABLE_KEY`, `CLERK_ALLOWED_ORIGINS`, existing `OWNER_EMAIL`, and secret `CLERK_SECRET_KEY`. Never put the secret in Git or browser configuration. Development and production keys/databases must remain separate. Staging's verified hostname is `norcal-veterans-staging.sterling-koliba.workers.dev`.

## Verification

- Local: focused access/authentication tests passed, including unsigned/invalid token denial, wrong issuer/origin, pending sessions, impersonation, grant/session revocation, account rebinding denial, scoped save/reopen and cross-organization denial. Required build passed 273 tests.
- Existing public-shell snapshot, approved public-contact and unified-card assertions were stale relative to checked-in public behavior. Assertions were reconciled; no public renderer or event-card runtime was changed. The pre-existing VFW generated meeting-card detail-link/page mismatch is outside this migration and remains unchanged.
- Staging: additive migration applied; Worker version `ed69ff74-4f13-4fed-945e-082fdda33cdb` deployed. Health/login assets return 200, unsigned HQ redirects to sign-in, unsigned private API returns 401. Synthetic user completed email-code and authenticator MFA, opened scoped HQ, saved its assigned draft organization, reloaded and verified the saved text, and signed out back to sign-in. Browser reported no console errors during the saved/reopened flow. The development-only test account is disabled after acceptance; synthetic history remains in staging.
- Production: DNS/TLS/mail verified; additive migration applied with 59 records, 5 grants and 98 revisions preserved at preflight. Live secret prepared. Owner invitation/sign-in and cutover verification remain release actions.
- Basic-flow follow-up: synthetic staging account signed in with email code only, without MFA. Request-agent automation deleted at the owner's request; Requests and history preserved, agent CLI retired, and HQ agent-health UI/polling disabled. The required final build passed 274 tests.

## Remaining release sequence

1. Owner selected email-code sign-in without MFA. Confirm the basic flow in staging before cutover.
2. Staging existing-user save/reopen and sign-out checks are complete. Verify production invitation acceptance with the owner before inviting real editors; the existing-user check did not exercise new-user enrollment.
3. Record current production Worker version and D1 Time Travel bookmark privately; no new private export is authorized. The request agent has been removed and must not be recreated.
4. Apply only additive migration 0006 to production. Configure production secret securely and set live publishable key and exact bare/www origins in `wrangler.jsonc`. Preserve Access configuration/policies for rollback. Do not accept development issuers on production.
5. Run the required release gate for the final source, publish through the connected GitHub-main build, and verify its exact version. Avoid duplicate manual production deployment.
6. Retire the old Access route gate only when the Clerk-protected Worker is ready. Keep rollback policy details privately. Invite the owner through the production instance; owner completes their own email verification and sign-in. Verify owner access plus scoped organization-editor access and no cross-scope access before broad invitations.
7. Verify anonymous API denial, public routes, sign-out and live revocation. Keep the request agent removed. Update current docs and record exact release evidence.

Rollback: restore the prior Worker/configuration and Cloudflare Access route gate together; keep the additive identity table and all grants/history. Do not restore the database merely to roll back code. A code rollback must also be reconciled with GitHub so the connected build does not undo it.

## Operational caution

Clerk CLI production-instance creation can return a secret key in its JSON. Capture/filter credential-producing commands instead of printing the response. The newly created, unused key that appeared during initial setup was immediately rotated; never reuse it. Local keys are restricted files under ignored `.data/clerk-migration/`. No credentials belong in this document.
