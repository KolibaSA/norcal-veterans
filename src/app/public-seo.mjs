import { eventDetailIsPublic } from '../modules/events/public.mjs';
import { localPagePaths } from '../local-pages.mjs';
import { origin } from '../shared/public-shell.mjs';

const publicId = id => typeof id === 'string' && /^[-_a-zA-Z0-9]{1,120}$/.test(id);
const staticPaths = ['/yolo-solano', '/regions', '/events', '/resources', '/about', '/memorial-day', '/for-organizations', '/share', '/privacy'];

export function robotsText(staging = false) {
  return `User-agent: *\nAllow: /\n${staging ? '' : `Sitemap: ${origin}/sitemap.xml\n`}`;
}

export function publicSitemap({ records = [], events = [] } = {}) {
  const paths = new Set(staticPaths);
  for (const path of localPagePaths(records, events)) paths.add(path);
  for (const record of records) if (publicId(record.id)) paths.add('/organizations/' + record.id);
  for (const event of events) if (publicId(event.id) && eventDetailIsPublic(event)) paths.add('/events/' + event.id);
  const urls = [...paths].map(path => `  <url><loc>${origin}${path}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
