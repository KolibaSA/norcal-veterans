# backup: browser contract

The existing owner-visible Download backup navigation action.

`navigation.html` is included by the HQ shell at build time. There is no browser controller: the existing download is a normal link to `/api/hq/export`.

The browser does not prefetch or store private exports; it follows the existing user-activated protected download route.

Dependencies: Common owner visibility at initialization and backup/server.mjs authorization. No feature editor dependencies.

Focused checks: `node scripts/run-tests.mjs --module backup`. Browser coverage: server backup authorization/export tests; browser acceptance verifies the navigation link without downloading private data. Wider release checks remain required before publication.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
