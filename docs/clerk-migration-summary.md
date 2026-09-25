# Clerk sign-in migration: completed September 24, 2026

NorCalVeterans HQ now uses Clerk for organization-user sign-in. The production site is available at [HQ sign-in](https://www.norcalveterans.org/hq/sign-in). The owner reported that account activation worked after the release. That report confirms invitation acceptance; a signed-in production workflow was not independently observed during the release checks.

## What changed

- Created separate Clerk development and production instances. Sign-in uses invitation-only email codes, with no MFA, as requested for the basic free setup.
- Added Clerk sign-in, sign-up, and sign-out pages to the existing HQ. The Worker verifies the Clerk session on protected requests and continues to enforce existing HQ roles, organization assignments, and region boundaries on the server.
- Added an identity table through an additive database migration. Existing organization records, grants, request history, audit history, and URLs were preserved.
- Added an HQ invitation action for people who already have an access assignment. An invitation alone does not grant an HQ role.
- Moved the old Cloudflare Access route gate off the active HQ paths. Its application and policies were retained as rollback standby. Clerk is now the active login system on both the `www` and bare domains.
- Retired the scheduled HQ request agent and disabled its runner and health polling. The Requests section and its history remain available for manual use.

## Release checks

The final production build passed 274 tests. Staging verified email-code sign-in without MFA, an assigned organization edit that persisted after reload, and sign-out. Production checks confirmed that the Clerk sign-in page loads, unsigned HQ requests redirect to sign-in, unsigned private API requests receive 401, and the public homepage and Events page still load. Database integrity checks passed, with existing record, grant, and revision counts unchanged after migration.

The Clerk-protected Worker was published through the connected GitHub build before the old Access route gate was retired. The owner subsequently confirmed that account activation worked. The release did not independently verify a signed-in production edit or invite other editors.

For implementation details, exact deployment identifiers, configuration, and rollback steps, see the [Clerk migration runbook](clerk-migration.md). Never put Clerk secret keys or private account recovery information in this repository.
