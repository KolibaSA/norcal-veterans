# submissions: browser contract

HQ review actions that prepare unpublished event or organization drafts from public intake and show the original private source separately.

`browser.mjs` exports `createFeature()`, `submissionDraft(submission, kind)` and `connectSubmissions(context)`. `actions.html` and `source.html` own review markup.

Owns pending/reviewed/rejected lifecycle and draft conversion. Copies only public_description into a public draft, retains intake_submission_id, and never transfers private submitter contact details or marks a draft verified.

Dependencies: Calls the injected `openDraft(kind, draft, source)` shell interface to open the destination feature. No imports from destination editor implementations. Public Share a Program intake code is documented separately in this module and its own feature.

Focused checks: `node scripts/run-tests.mjs --module submissions`. Browser coverage: private-data exclusion, unpublished draft conversion, allowed target kinds, unsaved-change guard and escaped original-source rendering. Wider release checks remain required before publication.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
