const link=(url,title,description,source)=>`<li><a href="${url}" target="_blank" rel="noopener noreferrer"><strong>${title}</strong><span>${description}</span><small>${source} ↗</small></a></li>`;
const section=(id,title,intro,items)=>`<section class="panel resource-section" id="${id}"><span class="eyebrow">VETERAN RESOURCES</span><h2>${title}</h2><p>${intro}</p><ul class="resource-links">${items.join('')}</ul></section>`;

export function resourcesPageContent(){
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
 return `<section class="wrap resources-page"><div class="resource-hero"><span class="eyebrow">REAL LINKS · CLEAR STARTING POINTS</span><h1>Veteran resources.<br><em>Help you can act on.</em></h1><p class="intro">Start locally or choose the kind of help you need. These links go to government agencies and established veteran organizations. Eligibility and availability can change, so confirm details with the provider.</p><div class="resource-urgent"><strong>Need urgent help?</strong><span>For a mental health crisis, call <a href="tel:988">988</a> and press 1 or text <a href="sms:838255">838255</a>. For homelessness or immediate housing risk, call <a href="tel:18774243838">877-424-3838</a>.</span></div></div><nav class="resource-jump" aria-label="Resource categories"><a href="#local">Local help</a><a href="#disability">Disability</a><a href="#education">Education</a><a href="#employment">Employment</a><a href="#housing">Housing</a><a href="#mental-health">Mental health</a></nav><div class="resource-grid">${local}${disability}${education}${employment}${housing}${mental}${network}</div><p class="small-note resource-reviewed">Links reviewed September 4, 2026. This directory does not determine eligibility, provide emergency services or replace advice from an accredited benefits counselor.</p></section>`;
}

