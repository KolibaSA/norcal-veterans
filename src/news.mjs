import { escapeHtml } from './shared/public-shell.mjs';

const h=escapeHtml;

// Keep each announcement in one place; Resources lists all items and the
// homepage features the pinned item, falling back to the newest item.
export const newsItems=Object.freeze([
 Object.freeze({
  id:'ca-sb-296',
  category:'California',
  title:'California expands property tax relief for qualifying disabled veterans',
  date:'2026-09-28',
  dateLabel:'Signed September 28, 2026',
  summary:'SB 296 creates a new Disabled Veterans’ Exemption for qualifying principal residences, starting with property tax lien dates in 2027. The law generally exempts 50% of the first $1 million of adjusted full value; qualifying lower-income households may receive a 100% exemption on that portion. Certain unmarried surviving spouses may also qualify.',
  details:[
   'Eligibility includes a qualifying service-connected disability rated at 100% (including compensation at the 100% rate due to unemployability). Applicants must meet the law’s residence and other requirements and provide documentation to their county assessor.',
   'The income threshold and property value cap are adjusted over time. The exemption applies to 2027–2031 property tax lien dates under the current law. Check the enacted bill and county assessor guidance for details.'
  ],
  sources:[
   {label:'Read SB 296 as enacted',url:'https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB296'},
   {label:'Governor’s announcement',url:'https://www.gov.ca.gov/2026/09/28/governor-newsom-signs-legislation-supporting-veterans-servicemembers/'}
  ],
  homepageFeature:true
 })
]);

export function latestNews(items=newsItems){
 return [...items].sort((a,b)=>b.date.localeCompare(a.date));
}

export function featuredNews(items=newsItems){
 const sorted=latestNews(items);
 return sorted.find(item=>item.homepageFeature)||sorted[0]||null;
}

function sourceLinks(item){
 return item.sources.map(source=>`<a href="${h(source.url)}" target="_blank" rel="noopener noreferrer">${h(source.label)} ↗</a>`).join('');
}

export function homepageNewsFeature(items=newsItems){
 const item=featuredNews(items);
 if(!item)return '';
 return `<section class="regional-news" id="news" aria-labelledby="regional-news-title"><div class="wrap"><div class="regional-heading" data-reveal><div><span class="eyebrow">NEWS</span><h2 id="regional-news-title">Decisions and updates that matter.</h2></div></div><article class="regional-news-card" data-reveal><div class="regional-news-copy"><p class="regional-news-meta"><span>${h(item.category)}</span><time datetime="${h(item.date)}">${h(item.dateLabel)}</time></p><h3>${h(item.title)}</h3><p>${h(item.summary)}</p></div><aside class="regional-news-action"><span class="regional-news-mark" aria-hidden="true">NEWS</span><strong>Read the latest</strong><p>See the full update and its official sources.</p><a href="/resources#latest-news">Latest News on Resources →</a>${sourceLinks(item)}</aside></article></div></section>`;
}

export function latestNewsSection(items=newsItems){
 const sorted=latestNews(items);
 return `<section class="latest-news" id="latest-news" aria-labelledby="latest-news-title"><header class="latest-news-heading"><span class="eyebrow">RECENT DECISIONS &amp; UPDATES</span><h2 id="latest-news-title">Latest News</h2><p>Important updates affecting veterans, with a short summary and a link to the original source. Confirm eligibility and next steps with the responsible agency.</p></header>${sorted.length?`<div class="latest-news-list">${sorted.map(item=>`<article class="latest-news-item"><p class="latest-news-meta"><span>${h(item.category)}</span><time datetime="${h(item.date)}">${h(item.dateLabel)}</time></p><h3>${h(item.title)}</h3><p>${h(item.summary)}</p>${item.details.map(detail=>`<p>${h(detail)}</p>`).join('')}<div class="latest-news-sources">${sourceLinks(item)}</div></article>`).join('')}</div>`:'<p class="panel">No news updates are published yet.</p>'}</section>`;
}
