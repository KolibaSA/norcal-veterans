# Share a Program

This feature lets a presenter submit a private program introduction for the HQ review queue. It is the public `/share` page, not a new HQ tab. It neither publishes content nor grants organization permissions.

Start here for form or introduction-validation changes. No Organization, Events, or Access implementation is needed for routine changes.

| Supported interface | Contract |
| --- | --- |
| `public.mjs: shareProgramPage(url, organizations, options)` | Active NorCal page HTML; `options` accepts `received` or escaped `error` text. Organization choices contain `id`, `verified_name`, `city`, `location_county`. |
| `domain.mjs: programSubmission(form, organizations)` | Validates `URLSearchParams` against live organization IDs and returns `{title, body}` for private review. `body` is the existing JSON string containing `kind: speaker`, contact details, recipients, description, topic, request and website. Throws existing validation messages. |
| `public.mjs: speakerSubmissionPage(...)` | Compatibility renderer for the preserved imported application. Active routes use `shareProgramPage`. |

The module owns consent, required presenter/contact/program fields, recipient selection/deduplication and field limits. Its markup and active private-review explanation are in `public.mjs`; pure validation is in `domain.mjs`. It has no direct database access.

The application workflow `src/app/public-intake.mjs` handles the form's bounded URL-encoded read, same-origin check, honeypot and forwarding to the existing `/api/submissions` route. That route is owned by Submissions and keeps records private/pending, rate limits submissions and requires Cloudflare's client-IP header. Only inspect those contracts when changing intake integration. The organization list is supplied by the application; selecting a recipient does not access organization-admin internals.

Dependencies: `src/shared/public-shell.mjs` for common HTML/escaping and `src/shared/public-http.mjs` for generic field/HTTPS validation. There are no runtime imports of Organizations, Events, Access, the HQ shell, or the local request runner.

Run `npm run test:module -- share-program`. Tests cover the review contract, recipient choices, invalid inputs, consent, HTML escaping and exact pre-refactor page markup. `src/app/public-intake.test.mjs` covers the workflow boundary, and `scripts/norcal-deployment.test.mjs` covers public-route/private-review integration. The page markup hash is a refactor regression snapshot; intentional design changes require reviewing and updating that expectation.

Existing limits and behavior are preserved, including the server's 150-character program-name limit. A submission is reviewed by the site team; the older imported application's separate presenter-inbox actions are not the active NorCal workflow.
