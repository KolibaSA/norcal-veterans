# attachments: browser contract

Existing attachment listing, multipart upload handling, configured-storage notices and edit-permission presentation.

`browser.mjs` exports `connectAttachments(context)`, installed as an editor extension. `editor.html` and `browser.css` own attachment markup/style.

Reads record attachment metadata and posts a file with its existing record_id. Retains the 10 MB client bound. Storage configuration and record edit eligibility control the upload UI. This refactor does not enable storage.

Dependencies: Injected API, message helper and read-only current-editor/identity context. Server authorizes protected attachment access.

Focused checks: `node scripts/run-tests.mjs --module attachments`. Browser coverage: storage/edit gating, size rejection without a request, multipart payload and list refresh. Wider release checks remain required before publication.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
