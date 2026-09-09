# Yolo County Veterans — Project Brief

September 2, 2026 · Version 0.3 · Transcript-informed build

The [public website](https://yolo-county-veterans.smartzgraphics.workers.dev) now includes 24 researched organizations, 38 source records, six dated events, calendar downloads and a working submission desk. The separate headquarters has task, review, event-publication, profile-correction and coordination tools, with 14 initial tasks and a meeting synthesis. Its live access remains locked pending approval of Cloudflare Zero Trust's required terms and overage-billing authorization. A local read-only preview is included with this handoff.

The September 2 meeting transcript has been incorporated as project context. Statements in the recording were not treated as permission to send messages, publish private details, grant access or collect money. Raw transcript content was not uploaded. The broader roadmap below remains a staged vision; organization accounts, email ingestion, flyer uploads, automatic syndication and payments are future work.

**Purpose**

Create one trusted local hub where veterans and their families can find relevant organizations, and organizations can find one another, share opportunities, and coordinate support. Long-term success means more useful connections, fewer dead ends, and less effort spent maintaining conflicting resource lists.

The confirmed project name is Yolo County Veterans. The latest user direction explicitly includes both Yolo and Solano counties in research and the first directory. Implementation and public deployment were authorized after initial planning. No organizational partnerships or direct profile confirmations have been established. The September 2 transcript now informs the next-phase punch list.

**What we know and what we need to learn**

The requested platform serves two connected audiences: people seeking veteran organizations and organizations seeking coordination. The initial opportunity is to make a useful next step clear: who serves this need, where they operate, who can use the service, and how to connect.

Existing resources provide a foundation:

| Public resource checked | Relevant finding | Planning implication |
| --- | --- | --- |
| [Solano County Veterans Services](https://www.solanocounty.gov/government/veterans-services) | The county office helps veterans, dependents, and survivors obtain benefits and describes collaboration with community organizations. | Candidate discovery partner for service descriptions, referral practices, and directory ownership. |
| [Yolo County Veterans Services Office](https://www.yolocounty.gov/government/general-government-departments/health-human-services/adults/veterans-service-office) | The office provides benefit assistance, information, referrals, and agency networking. | Candidate discovery partner for Yolo County. |
| [211 Yolo veterans resources](https://www.211sacramento.org/211/Yolo-Veterans/) | Existing navigation covers benefits assistance, crisis services, counseling, and support groups. | Explore linking, reuse permissions, update practices, and gaps before duplicating records. |
| [Solano County community resources](https://www.solanocounty.gov/government/public-defender/community-resources) | The county points residents to 211 Bay Area and other local service pathways. | Map existing general community support alongside veteran-specific services. |

These are public-source findings checked September 2, 2026, not confirmed partner relationships. A limited web review cannot establish that a coordination gap exists. The working hypothesis is that local organizations would benefit from current partner contacts, shared events, and clearer referral instructions across organizations. Interviews must test this.

**People and responsibilities**

| Stakeholder | Core need | Proposed role |
| --- | --- | --- |
| Veterans across service eras and life circumstances | Find a relevant service or community group without needing to know agency names or disclose a personal history. | Test search, clarity, accessibility, and trust. |
| Families, caregivers, dependents, and survivors | Understand which services include them and how to help someone connect. | Test eligibility wording and shared/printed information. |
| Veteran organizations, posts, and peer groups | Be discoverable; find collaborators, events, and volunteers. | Maintain listings and participate in coordination. |
| Service providers and navigators | Understand service boundaries, contact routes, and handoff requirements. | Validate service details and partner workflows. |
| County offices and existing resource networks | Avoid conflicting information and unnecessary duplicate maintenance. | Advise on authoritative sources and sustainable updates. |
| Sponsor and community steering group | Set priorities, resolve disputes, and sustain the hub. | Own mission, funding, participation rules, and roadmap. |
| Directory steward and technical maintainer | Keep information trustworthy and the service usable. | Review changes, verify contacts, manage access, and support operation. |

Aaron and the founding group should identify a sponsor and a named directory steward. These roles are proposed and unassigned. A small steering group should include veterans, smaller organizations, and service providers, with a clear way to challenge inaccurate listings or unfair inclusion decisions.

**Priority journeys**

1. **Find support:** A visitor selects a need and city or ZIP code, sees services covering that area, understands eligibility and access requirements, and calls or visits the provider's intake page. No account is required.
2. **Find community:** A veteran discovers a local organization, activity, or volunteer opportunity and sees how to participate, including cost and accessibility information.
3. **Find a partner:** An approved organization representative finds another organization's designated contact and referral instructions, then connects through the listed channel.
4. **Coordinate activity:** A representative submits an event, service update, or collaboration request; a steward reviews it for the appropriate public or partner audience.
5. **Keep information current:** A representative submits a correction; the steward checks the change, records its source and date, and publishes it.

Discovery should include people with limited internet access, disabilities, transportation barriers, and low familiarity with veteran services. Ask language preferences directly. Test a phone-friendly and printable route alongside the website.

**Staged product vision**

| Stage | Useful outcome | Scope | Evidence needed to advance |
| --- | --- | --- | --- |
| 0 — Validate the network | A small group agrees on the problem and maintenance responsibilities. | Interviews, existing-resource comparison, draft directory records, and sample user journeys. | Confirmed geography, sponsor, steward, and willingness from an initial partner group. |
| 1 — Trusted local hub | Veterans find a usable next step; partners find one another. | Public directory, event list, approved partner contacts, moderated coordination updates, and admin tools. | Successful pilot journeys, useful partner connections, and reliable updates. |
| 2 — Active coordination | Partners repeatedly use the hub for shared work. | Organization self-service, notification preferences, shared projects, timestamped service availability, and approved data exchange. | Recurring use and measured reduction in coordination effort; capacity to moderate and support it. |
| 3 — Supported referrals | Participating providers can acknowledge and follow up on agreed handoffs. | Carefully scoped referral workflow with consent, named recipients, limited access, status tracking, and retention rules. | A demonstrated need, accountable receiving partners, appropriate privacy/security review, and funded operation. |

Advanced search assistance or automated matching can be evaluated later if ordinary filters prove insufficient. Any assistance must show its source and freshness, allow human correction, and avoid deciding eligibility or inventing service availability.

**Recommended MVP**

Start with a mobile-friendly website and a deliberately small partner pilot. Proposed pilot size: 5–10 participating organizations and 20–30 service or community listings, adjusted to the confirmed geography and discovery results. A small organization may offer several distinct programs; a program may operate at several locations.

| Priority feature | Minimum behavior | Acceptance example |
| --- | --- | --- |
| Searchable public directory | Filter by need and service area; show eligibility, cost, access method, contact, and source date. | A person can locate an appropriate contact without signing in; physical distance does not override service-area eligibility. |
| Useful organization/service pages | Distinguish organization, program, and location; include public contact actions and clear unknown fields. | Separate programs at one organization do not appear to offer the same eligibility or hours. |
| Shared event list | Date, location or virtual link, audience, organizer, access details, and cancellation status. | Past events leave the upcoming view automatically; corrections can be submitted. |
| Approved partner area | Search designated partner contacts and see moderated collaboration requests and service updates. | An approved representative can find another partner; a public visitor cannot access private contacts. |
| Listing and update submissions | Organization claim/update requests and correction reports enter a review queue. | A submitted change becomes public only after steward approval. |
| Steward controls | Approve representatives, edit and archive entries, track verification, and review changes. | The steward can identify who changed a contact and restore the previous version. |
| Accessible contact routes | Readable mobile layout, keyboard operation, labeled controls, strong contrast, and printable information. | Users can complete the priority journey without using a map or a mouse. |

Candidate need categories: benefits navigation; housing and essentials; employment and education; health and wellbeing navigation; transportation; family support; community and recreation; volunteering. Validate these labels with users rather than adopting agency jargon.

MVP referrals mean clear provider contact and intake instructions. Individual case transfers, veteran profiles, document uploads, open chat, public reviews, fundraising transactions, and automated eligibility decisions are outside the initial release. The partner area still supplies concrete organization-to-organization value through contacts, collaboration requests, and shared events.

**Trust and practical data handling**

Keep the first data model focused on organizations, services, locations, contacts, events, approved partner users, submissions, and change history. Each service record should carry its service area, eligibility statement, access instructions, source URL, last checked date, check method, and next review date. Use stable identifiers so duplicate records can be reconciled and data can be exported later.

Distinguish “checked against a public source” from “confirmed by the organization.” A confirmation label concerns the recorded facts; it is not an endorsement or accreditation. Publish inclusion criteria and distinguish veteran-specific organizations from general providers serving veterans. Do not sell search placement.

Proposed maintenance rule: partner confirmation every 90 days, with more frequent review of volatile contacts or availability. Flag overdue information visibly, investigate broken contacts, and suppress contact routes known to be wrong. Confirmed closures should be archived. Start the pilot with every published contact and access route reviewed. Record a named owner and backup for each participating organization's information.

Separate public business information from permissioned partner contacts. Obtain permission before exposing nonpublic details; prefer role-based office contacts. Verify representatives through an independently located organizational contact, not simply the details supplied in a claim form. Limit each representative to their organization's changes; require stronger account protection for administrators, including multifactor authentication.

Visitors should browse without identity checks, veteran-status documents, exact GPS location, or accounts. Do not collect Social Security numbers, DD-214s, diagnoses, benefits files, or personal case narratives in the MVP. Correction and collaboration forms should explicitly exclude individual client information, constrain fields, and undergo moderation before publication.

Use aggregate activity counts and voluntary, separate research feedback. Avoid advertising trackers, session recordings, persistent visitor profiles, and stored raw search text. Set retention periods before launch; a provisional default is to remove resolved submission contact details after 90 days and keep minimal administrative change history for 12 months, subject to the operator's review. Provide a correction/deletion contact, secure backups, a tested restore process, and a named incident owner.

If identifiable referral data becomes necessary later, first establish exactly what is shared, why, with whom, and for how long. Require specific consent where appropriate, restrict access to the receiving participants, avoid network-wide case broadcasts, and review applicable obligations with qualified advisers. A directory design does not establish the requirements for a future case-management system.

Provide clearly labeled urgent-help links, with no suggestion that the hub's forms are continuously monitored. The official [Veterans Crisis Line](https://www.veteranscrisisline.net/) lists 988 then Press 1, text 838255, and online chat. Verify these routes again before launch and during maintenance.

**Pilot plan and delivery gates**

The following is an illustrative 8–10-week sequence for expanding and validating the initial release after a sponsor, team, and pilot scope are agreed. It is a planning estimate, not a launch commitment. The first public directory prototype is deployed; partner outreach has not been started.

| Period | Work and proposed owner | Concrete result |
| --- | --- | --- |
| Weeks 1–2 | Sponsor and product lead confirm geography; interview 8–12 veterans/family members and 5–8 organization representatives. | Validated top journeys, initial partner commitments, and a comparison with existing resources. |
| Weeks 3–4 | Steward and product lead prepare sample listings, workflow sketches, access rules, and a maintenance plan. | A tested prototype specification, bounded backlog, operating estimate, and build decision. |
| Weeks 5–7 | An assigned builder and steward implement the approved MVP and onboard the pilot group. | Working pilot with reviewed content, permission checks, accessibility checks, backups, and support ownership. |
| Weeks 8–10 | Pilot participants test real discovery and coordination tasks; product lead measures results. | Prioritized fixes and an evidence-based decision to launch, revise, or keep the pilot small. |

Proposed launch gates: at least 8 of 10 test participants independently find a relevant next contact; all published contact routes are reviewed for launch; at least 5 pilot organizations report a useful partner connection or coordination action; permission tests reveal no public exposure of private partner contacts; a steward and backup have accepted ongoing work. These are targets to agree during discovery, not results already achieved.

During the pilot, measure search success, dead ends, listing freshness, update effort, and organization participation. Count contact clicks as contact attempts only. Use optional follow-up interviews to learn whether a connection actually helped; do not claim that clicks represent completed referrals or services received.

Budget separately for discovery/design, initial implementation, content verification, hosting/accounts, accessibility and security review, and ongoing stewardship. Reserve a provisional 4–8 staff hours per week for the small pilot's content and partner support, then measure actual workload. Obtain implementation estimates after prototype testing. Choose technology based on exportability, access controls, maintainability, and the team's skills; no vendor has been selected.

**Discovery questions and next decisions**

Ask veterans to describe the last time they sought an organization: where they started, where they got stuck, what made information credible, and what they were comfortable sharing. Ask organizations to walk through a recent handoff, how they maintain contact lists, who could keep a listing current, and what information they should never place in a shared workspace. Ask both audiences to compare a sample hub journey with the resources they already use.

| Decision | Proposed starting point | Who resolves it / timing |
| --- | --- | --- |
| Name and geography | Confirmed name: Yolo County Veterans. Current directory/research coverage: Yolo and Solano counties. | Resolved by user direction on September 2, 2026. |
| Sponsor and data stewardship | One accountable sponsor, one directory steward, and a backup; veteran participation in governance. | Founding group, before partner onboarding. |
| First participants | 5–10 organizations across the highest-priority needs and confirmed area. | Sponsor with discovery participants. |
| Initial scope | Public discovery plus basic partner coordination; no individual case records. | Sponsor after discovery findings. |
| Funding and build timing | Fund upkeep alongside implementation; estimate after prototype testing. | Sponsor before authorizing implementation. |

The immediate next step is to review the forthcoming transcript, identify founding organizations and a directory steward, and prioritize verified profile updates and secure organization access. The requested first live release is complete. Further development should follow that input.
