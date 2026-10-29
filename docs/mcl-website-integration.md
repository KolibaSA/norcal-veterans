# MCL 627 continuous-page integration

October 29, 2026: companion published and coordinated staging acceptance passed; NorCal production publication pending.

## Behavior and ownership

The existing MCL 627 card opens `/organizations/mcl-yolo`. The NorCal banner remains above the full-width YoloMarines.org website. NorCal's upcoming events and collapsed source evidence remain below the website. Other organization profiles retain their existing behavior.

`public/assets/mcl-website.js` initializes the specific frame using its exact source origin and the parent viewport height. It accepts a versioned height message only from that frame's window and origin, with a finite height between 200 and 60,000 pixels. The frame then expands, removes its size cap and disables its inner scrolling. Its direct website links remain available if the external site cannot load or communicate. Its remote content stays on YoloMarines.org; it is not copied or proxied by the live NorCal Worker.

The companion `public/norcal-embed.js` runs only when framed. It requires the actual parent window and an approved NorCal production or staging origin. A loopback parent is allowed only when the companion itself runs on loopback. It reports the natural body height after size, image and font changes. Embedded viewport-sized sections use the parent viewport height, preventing an expanding-frame feedback loop. Standalone website visits retain their normal layout and scroll behavior. Existing content, images and logos are unchanged.

## Prepared companion source

- Repository: `KolibaSA/mcl-yolo-627-site`.
- Published companion commit: `28eb382`, Worker `bbd7df2b-fea1-4bd3-be4b-d6bdf4fb909d`, [successful deployment](https://github.com/KolibaSA/mcl-yolo-627-site/actions/runs/40837655937).
- Clean checkout: `/tmp/norcal-mcl-embed-source-20261029`, based on `7772cdb`.
- Durable companion patch: [integrations/yolomarines-continuous-page.patch](integrations/yolomarines-continuous-page.patch). It includes the script, HTML reference, embedded-only layout rules, README and focused tests.
- The existing `/Users/Sterling/Documents/Codex/MCL-627` checkout has unrelated edited and untracked artwork/content. It was read only and must remain untouched.
- The synced MCL ChatGPT project contains reference material, not this site's editable source.

Apply the patch only to an up-to-date clean checkout, inspect changes and run `node --test tests/norcal-embed.test.mjs`. If upstream changes conflict, reconcile only this integration while preserving newer site content.

## Verification and preview

The initial fixed-height embed was verified on staging Worker `532d2666-fed1-4eed-8b48-f8040106dfc6`. Its temporary synthetic organization record was removed. The continuous-height revision passed hosted acceptance on staging Worker `c4a68ea2-a738-4df5-b453-3de8ee20e9c0`, using the live YoloMarines.org companion. Its temporary synthetic record was removed; fixture count returned to zero.

The paired local preview is `http://127.0.0.1:8796/organizations/mcl-yolo?paired`, with the child on port 8797. It substitutes only the frame URL in a loopback preview server; production markup still references `https://www.yolomarines.org/`. The preview servers are `/tmp/norcal-mcl-website-preview.mjs` and `/tmp/norcal-mcl-child-preview.mjs`.

NorCal build: 340 tests passed. Active checks: 229 passed. Organizations module: 14 passed. Companion: two passed. Browser checks covered phone and desktop reflow, exact available-width coverage, stable content height, no clipped footer, outer-page scrolling over the website and inner scroll position zero. Origin/window rejection, invalid heights, shrinking and viewport handshakes are tested.

## Coordinated release and rollback

1. After publication authorization, update the clean companion checkout from its remote and preserve any newer upstream work. Commit/push only the integration. Its documented GitHub Actions deployment is manually triggered. Verify the companion is live before relying on automatic height.
2. Deploy this NorCal revision to the existing isolated staging Worker. Use a clearly synthetic temporary `mcl-yolo` record only if needed, then remove it. Verify the actual remote website reports height and all content is reachable with one scrollbar on phone and desktop. Preserve the direct website fallback.
3. Publish NorCal through connected GitHub `main`, then verify the live canonical profile, parent CSP, complete website footer, event links and main-page scrolling. No migration or production data edit is required.
4. Code rollback on NorCal returns to `c2dd7fc` through the connected GitHub path. The companion can remain deployed because standalone behavior is unchanged. If reverting the companion, restore the preceding safe NorCal version first to avoid depending on missing height messages.

Hosted acceptance confirmed exact available-width coverage at phone and desktop widths, the entire remote website footer within the expanded frame, zero inner scroll position and outer-page scrolling over the website. NorCal production still requires its connected release and live verification.
