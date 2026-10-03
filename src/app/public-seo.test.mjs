import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSitemap, robotsText } from './public-seo.mjs';

test('sitemap lists canonical public pages once and excludes private, draft and suppressed event URLs', () => {
  const xml = publicSitemap({ records: [
    { id: 'mcl-yolo' }, { id: 'mcl-yolo' }, { id: 'bad<id>' },
    { id: 'davis-one', city: 'Davis', location_county: 'Yolo' },
    { id: 'davis-two', city: 'Davis', location_county: 'Yolo' }
  ], events: [
    { id: 'community-event', status: 'published', kind: 'Community event' },
    { id: 'draft-event', status: 'draft', kind: 'Community event' },
    { id: 'vfw-meeting', status: 'published', kind: 'Organization meeting', organization_id: 'vfw-ca-8151' }
  ] });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<loc>https:\/\/www\.norcalveterans\.org\/yolo-solano<\/loc>/);
  assert.match(xml, /<loc>https:\/\/www\.norcalveterans\.org\/organizations\/mcl-yolo<\/loc>/);
  assert.match(xml, /<loc>https:\/\/www\.norcalveterans\.org\/events\/community-event<\/loc>/);
  assert.match(xml, /<loc>https:\/\/www\.norcalveterans\.org\/locations\/yolo-county<\/loc>/);
  assert.match(xml, /<loc>https:\/\/www\.norcalveterans\.org\/locations\/davis<\/loc>/);
  assert.match(xml, /<loc>https:\/\/www\.norcalveterans\.org\/resources\/disability<\/loc>/);
  assert.equal((xml.match(/\/organizations\/mcl-yolo<\/loc>/g) || []).length, 1);
  assert.doesNotMatch(xml, /bad<id>|draft-event|vfw-meeting|<loc>https:\/\/www\.norcalveterans\.org\/mcl-yolo<\/loc>|\/hq|\/api\//);
});

test('robots declares the production sitemap without advertising it on staging', () => {
  assert.match(robotsText(), /Sitemap: https:\/\/www\.norcalveterans\.org\/sitemap\.xml/);
  assert.doesNotMatch(robotsText(true), /Sitemap:/);
});
