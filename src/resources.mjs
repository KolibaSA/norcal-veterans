import { escapeHtml } from './shared/public-shell.mjs';
import { eventDetailIsPublic, upcomingEvents } from './modules/events/public.mjs';

const h=escapeHtml;
const link=(url,title,description,source)=>`<li><a href="${url}" target="_blank" rel="noopener noreferrer"><strong>${title}</strong><span>${description}</span><small>${source} ↗</small></a></li>`;
const section=(id,title,intro,items)=>`<section class="panel resource-section" id="${id}"><span class="eyebrow">VETERAN RESOURCES</span><h2>${title}</h2><p>${intro}</p><ul class="resource-links">${items.join('')}</ul><p><a class="resource-topic-link" href="/resources/${id}">Open the ${title.toLowerCase()} guide →</a></p></section>`;
const topicData={
 local:{title:'Local benefits and services',description:'Official Yolo and Solano County veterans service offices and local benefits guidance.'},
 disability:{title:'VA disability and claims',description:'Official VA disability compensation information and free accredited claims assistance.'},
 education:{title:'Education and training',description:'VA education benefits, GI Bill eligibility and local college fee waiver information.'},
 employment:{title:'Employment and careers',description:'Veteran career, job training and employment services from official and established providers.'},
 housing:{title:'Housing and homelessness',description:'VA home loan, housing assistance and homelessness support resources.'},
 'mental-health':{title:'Mental health and connection',description:'Confidential counseling, Vet Center care and crisis support for Veterans and families.'},
 'organization-help':{title:'Local veteran organizations',description:'Connect official national veteran organization programs with published local profiles.'}
};
export const resourceTopicIds=Object.freeze(Object.keys(topicData));
export const resourceTopicMeta=id=>topicData[id]||null;

function relatedProfiles(topicId,organizations){
 const terms={disability:/benefit|claim|referral/i,education:/education|referral|benefit/i,employment:/career|employment|job/i,housing:/referral|housing|benefit/i,'mental-health':/equine|wellness|mental|referral/i};
 const categoryMatch=terms[topicId];
 return organizations.filter(record=>{
  const type=record.organization_type||'';
  if(topicId==='local')return type==='County Veterans Office';
  if(topicId==='organization-help')return ['VFW','American Legion','DAV','Marine Corps League'].includes(type);
  if(topicId==='employment'&&type==='Veterans Beer Club')return true;
  if(topicId==='mental-health'&&type==='Equine program provider')return true;
  return categoryMatch&&(record.service_categories||[]).some(category=>categoryMatch.test(category));
 }).slice(0,8);
}

function localConnections(topicId,organizations,events){
 const profiles=relatedProfiles(topicId,organizations);
 const profileHtml=profiles.length?`<section class="panel resource-local-links"><h2>Published local organization profiles</h2><ul>${profiles.map(record=>`<li><a href="/organizations/${encodeURIComponent(record.id)}"><strong>${h(record.verified_name)}</strong><span>${h(record.city||record.location_county+' County')} · ${h(record.organization_type)}</span></a></li>`).join('')}</ul></section>`:'';
 const countyLinks=`<section class="panel resource-local-links"><h2>Explore local communities</h2><p>Browse county pages for published profiles, upcoming local events and county services.</p><p><a href="/locations/yolo-county">Yolo County veterans organizations and events →</a></p><p><a href="/locations/solano-county">Solano County veterans organizations and events →</a></p></section>`;
 const localEvents=upcomingEvents(events.filter(eventDetailIsPublic)).slice(0,3);
 const eventHtml=localEvents.length?`<section class="panel resource-local-links"><h2>Upcoming local events</h2><ul>${localEvents.map(event=>`<li><a href="/events/${encodeURIComponent(event.id)}"><strong>${h(event.title)}</strong><span>${h(event.city||event.county+' County')} · ${h(event.venue)}</span></a></li>`).join('')}</ul><p><a href="/events">Browse all community events →</a></p></section>`:`<section class="panel resource-local-links"><h2>Community events</h2><p><a href="/events">Browse the Yolo-Solano event calendar →</a></p></section>`;
 return `${profileHtml}${countyLinks}${eventHtml}`;
}

export function resourcesPageContent(organizations=[],events=[],topicId=''){
 const local=section('local','Start with a local benefits counselor','County Veterans Service Offices offer free help understanding and applying for federal, state and local benefits.',[
  link('https://www.yolocounty.gov/government/general-government-departments/health-human-services/adults/veterans-service-office','Yolo County Veterans Service Office','Benefits counseling, claim preparation, appeals, referrals and some transportation support.','Yolo County'),
  link('https://www.solanocounty.gov/government/veterans-services','Solano County Veterans Service Office','Benefits counselors, claim help, walk-in information and appointments.','Solano County'),
  link('https://www.solanocounty.gov/government/veterans-services/veterans-benefit-programs','Solano County Veterans Benefit Programs','A local guide to disability, education, housing, pension and survivor programs.','Solano County')
 ]);
 const disability=section('disability','VA disability and claims','Learn what disability compensation covers, prepare a claim, or connect with free accredited assistance.',[
  link('https://www.va.gov/disability/','VA disability compensation','Eligibility, disability ratings, benefit rates and claim management.','U.S. Department of Veterans Affairs'),
  link('https://www.va.gov/disability/how-to-file-claim/','How to file a disability claim','Official steps, evidence guidance and ways to file.','U.S. Department of Veterans Affairs'),
  link('https://www.dav.org/get-help-now/','Free DAV benefits assistance','Find DAV help with claims, benefits, transition and transportation.','Disabled American Veterans')
 ]);
 const education=section('education','Education and training','Compare earned education benefits and find the right starting point for college, training or a new career.',[
  link('https://www.va.gov/education/','VA education benefits','GI Bill and other education and training programs.','U.S. Department of Veterans Affairs'),
  link('https://www.va.gov/education/eligibility/','GI Bill eligibility','Check eligibility for Veterans, service members, spouses and dependents.','U.S. Department of Veterans Affairs'),
  link('https://www.solanocounty.gov/government/veterans-services/veterans-benefit-programs','California college fee waiver guidance','Local information on the CalVet College Fee Waiver and VA education benefits.','Solano County')
 ]);
 const employment=section('employment','Employment and careers','Find job-search help, training, vocational rehabilitation and employers looking for military experience.',[
  link('https://www.va.gov/careers-employment/','VA careers and employment','Career counseling, Veteran Readiness and Employment, training and small-business help.','U.S. Department of Veterans Affairs'),
  link('https://edd.ca.gov/en/jobs_and_training/services_for_veterans/','California services for Veterans','Priority job services, career specialists, training and CalJOBS.','California Employment Development Department'),
  link('https://www.dav.org/member-resources/employment/','DAV employment assistance','Career fairs, job listings and employment resources for Veterans and spouses.','Disabled American Veterans'),
  link('https://www.legion.org/member-services/veterans-services/veterans-careers','American Legion veteran careers','Career events, employer connections and job-search resources.','The American Legion')
 ]);
 const housing=section('housing','Housing and homelessness','Get help buying or keeping a home, adapting a home, preventing homelessness or finding emergency shelter.',[
  link('https://www.va.gov/housing-assistance/','VA housing assistance','VA-backed home loans, housing grants and foreclosure help.','U.S. Department of Veterans Affairs'),
  link('https://www.va.gov/resources/homeless-help/','Homeless and at-risk Veteran help','Confidential 24/7 access to shelter, prevention and long-term housing support.','U.S. Department of Veterans Affairs'),
  link('https://department.va.gov/homeless/','VA homeless programs','HUD-VASH, SSVF, employment, legal and other housing-stability programs.','U.S. Department of Veterans Affairs')
 ]);
 const mental=section('mental-health','Mental health and connection','Connect with confidential counseling, VA mental health care and immediate crisis support.',[
  link('https://www.mentalhealth.va.gov/','VA Mental Health','Understand concerns, explore treatment and connect to care.','U.S. Department of Veterans Affairs'),
  link('https://www.vetcenter.va.gov/','Vet Centers','Confidential counseling and outreach for eligible Veterans, service members and families.','U.S. Department of Veterans Affairs'),
  link('https://www.vetcenter.va.gov/VETCENTER/New_Vet_Centers.asp','Solano County Vet Center Outstation','Official information about the Fairfield outstation and how to make an appointment.','U.S. Department of Veterans Affairs'),
  link('https://www.veteranscrisisline.net/','Veterans Crisis Line','Call 988, then press 1; text 838255; or start a confidential chat.','Veterans Crisis Line')
 ]);
 const network=section('organization-help','Help from organizations in this directory','These national programs connect to organization types already represented in the Yolo-Solano directory.',[
  link('https://www.dav.org/get-help-now/','DAV: Get Help Now','Benefits advocates, transition help, transportation and local support.','Disabled American Veterans'),
  link('https://www.legion.org/advocacy/be-the-one','American Legion: Be the One','Suicide-prevention resources, peer connection and free benefits assistance.','The American Legion'),
  link('https://www.vfw.org/assistance/va-claims-separation-benefits','VFW VA claims and separation benefits','Accredited help with VA claims and benefits at no cost.','Veterans of Foreign Wars')
 ]);
 const topics=[local,disability,education,employment,housing,mental,network];
 if(topicId){
  const meta=resourceTopicMeta(topicId),body=topics.find(html=>html.includes(`id="${topicId}"`));
  if(!meta||!body)return null;
  return `<section class="wrap resources-page resource-topic-page"><p class="local-breadcrumbs"><a href="/resources">All veteran resources</a></p><header class="resource-hero"><span class="eyebrow">VETERAN RESOURCES · YOLO-SOLANO</span><h1>${h(meta.title)}</h1><p class="intro">${h(meta.description)} Provider eligibility and availability can change; confirm details directly with the listed source.</p></header>${body}<div class="resource-related-grid">${localConnections(topicId,organizations,events)}</div><p class="small-note"><a href="/resources">Return to the full veteran resource guide →</a></p></section>`;
 }
 const labels={'local':'Local help','disability':'Disability','education':'Education','employment':'Employment','housing':'Housing','mental-health':'Mental health','organization-help':'Organization programs'};
 return `<section class="wrap resources-page"><div class="resource-hero"><span class="eyebrow">REAL LINKS · CLEAR STARTING POINTS</span><h1>Veteran resources.<br><em>Help you can act on.</em></h1><p class="intro">Start locally or choose the kind of help you need. These links go to government agencies and established veteran organizations. Eligibility and availability can change, so confirm details with the provider.</p><div class="resource-urgent"><strong>Need urgent help?</strong><span>For a mental health crisis, call <a href="tel:988">988</a> and press 1 or text <a href="sms:838255">838255</a>. For homelessness or immediate housing risk, call <a href="tel:18774243838">877-424-3838</a>.</span></div></div><nav class="resource-jump" aria-label="Resource categories">${topics.map((_,index)=>{const id=resourceTopicIds[index];return `<a href="#${id}">${labels[id]}</a>`;}).join('')}</nav><div class="resource-grid">${topics.join('')}</div><div class="resource-related-grid"><section class="panel resource-local-links"><h2>Find help by county</h2><p><a href="/locations/yolo-county">Yolo County veterans organizations and events →</a></p><p><a href="/locations/solano-county">Solano County veterans organizations and events →</a></p></section><section class="panel resource-local-links"><h2>Find upcoming community events</h2><p>Events connect people with local organizations and opportunities to participate. Check each listing with its host before attending.</p><p><a href="/events">Browse the Yolo-Solano event calendar →</a></p></section></div><p class="small-note resource-reviewed">Links reviewed September 4, 2026. This directory does not determine eligibility, provide emergency services or replace advice from an accredited benefits counselor.</p></section>`;
}

