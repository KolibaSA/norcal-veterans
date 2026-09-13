import { canonicalDate, invalid, object, pacificToInstant, present, text } from '../../shared/validation.mjs';

export const VFW_8151_ID = 'vfw-ca-8151';
export const meetingMonthNames = Object.freeze(['January','February','March','April','May','June','July','August','September','October','November','December']);
export const meetingTimeSlots = 3;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const pad = value => String(value).padStart(2, '0');
const fieldName = (name, month, slot = '') => `meeting${name}${month}${slot ? '_' + slot : ''}`;
const currentPacificYear = () => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric' }).format(new Date()));

export function thirdThursday(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const day = 1 + (4 - first.getUTCDay() + 7) % 7 + 14;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function defaultMeetingTimes() {
  return [
    { time: '18:00', label: 'Social hour' },
    { time: '19:00', label: 'Post meeting' },
    { time: '20:00', label: 'Social time' }
  ];
}

export function preferredMeetingYear(plans, nowYear = currentPacificYear()) {
  const years = Array.isArray(plans) ? plans.map(plan => Number(plan?.year)).filter(Number.isInteger).sort((a, b) => a - b) : [];
  return years.find(year => year >= nowYear) ?? years.at(-1) ?? nowYear + 1;
}

function planFor(payload, requestedYear) {
  const plans = Array.isArray(payload?.meeting_plans) ? payload.meeting_plans : [];
  const year = Number(requestedYear) || preferredMeetingYear(plans);
  return { year, plan: plans.find(entry => Number(entry?.year) === year) };
}

export function meetingPlanFields(record = {}, requestedYear) {
  const enabled = record.id === VFW_8151_ID || record.payload?.id === VFW_8151_ID;
  const { year, plan } = planFor(record.payload, requestedYear);
  const meetings = new Map((Array.isArray(plan?.meetings) ? plan.meetings : []).map(meeting => [Number(meeting.month), meeting]));
  const fields = { meetingPlannerOrganization: enabled ? VFW_8151_ID : '', meetingPlanYear: enabled ? String(year) : '' };
  for (let month = 1; month <= 12; month++) {
    const meeting = meetings.get(month), savedTimes = meeting ? Array.from({ length: meetingTimeSlots }, (_, index) => ({ time: meeting[`time_${index + 1}`], label: meeting[`label_${index + 1}`] })).filter(entry => entry.time || entry.label) : [], times = savedTimes.length ? savedTimes : defaultMeetingTimes();
    fields[fieldName('Date', month)] = enabled ? meeting?.date ?? thirdThursday(year, month) : '';
    fields[fieldName('Title', month)] = enabled ? meeting?.title ?? 'Dixon VFW Post 8151 monthly meeting' : '';
    fields[fieldName('Notes', month)] = enabled ? meeting?.notes ?? '' : '';
    for (let slot = 1; slot <= meetingTimeSlots; slot++) {
      fields[fieldName('Time', month, slot)] = enabled ? times[slot - 1]?.time ?? '' : '';
      fields[fieldName('Label', month, slot)] = enabled ? times[slot - 1]?.label ?? '' : '';
    }
  }
  return fields;
}

export function meetingPlansFromFields(fields, previous = {}) {
  if (fields.meetingPlannerOrganization !== VFW_8151_ID) return Array.isArray(previous.meeting_plans) ? structuredClone(previous.meeting_plans) : undefined;
  const year = Number(fields.meetingPlanYear), meetings = [];
  for (let month = 1; month <= 12; month++) {
    const date = String(fields[fieldName('Date', month)] ?? '').trim();
    const title = String(fields[fieldName('Title', month)] ?? '').trim();
    const notes = String(fields[fieldName('Notes', month)] ?? '').trim();
    const times = [];
    for (let slot = 1; slot <= meetingTimeSlots; slot++) {
      const time = String(fields[fieldName('Time', month, slot)] ?? '').trim();
      const label = String(fields[fieldName('Label', month, slot)] ?? '').trim();
      if (time || label) times.push({ time, label });
    }
    if (date || title || notes || times.length) meetings.push({ month, date, title, notes, ...Object.fromEntries(times.flatMap((entry, index) => [[`time_${index + 1}`, entry.time], [`label_${index + 1}`, entry.label]])) });
  }
  const plans = (Array.isArray(previous.meeting_plans) ? structuredClone(previous.meeting_plans) : []).filter(plan => Number(plan?.year) !== year);
  plans.push({ year, meetings });
  return plans.sort((a, b) => Number(a.year) - Number(b.year));
}

export function validateMeetingPlans(value, organizationId) {
  if (!present(value)) return;
  if (organizationId !== VFW_8151_ID) invalid('The monthly meeting planner is available only for VFW Post 8151.');
  if (!Array.isArray(value) || value.length > 6) invalid('Meeting plans must contain at most six years.');
  const years = new Set;
  for (const plan of value) {
    if (!object(plan) || !Number.isInteger(plan.year) || plan.year < 2026 || plan.year > currentPacificYear() + 6 || years.has(plan.year)) invalid('Choose a valid, unique meeting-plan year.');
    years.add(plan.year);
    if (!Array.isArray(plan.meetings) || plan.meetings.length > 12) invalid('A meeting plan can contain at most twelve monthly meetings.');
    const months = new Set;
    for (const meeting of plan.meetings) {
      if (!object(meeting) || !Number.isInteger(meeting.month) || meeting.month < 1 || meeting.month > 12 || months.has(meeting.month)) invalid('Each meeting-plan month must be unique.');
      months.add(meeting.month); canonicalDate(meeting.date);
      if (Number(meeting.date.slice(0, 4)) !== plan.year || Number(meeting.date.slice(5, 7)) !== meeting.month) invalid(`${meetingMonthNames[meeting.month - 1]} must use a date in that month.`);
      text(meeting.title, 'Meeting title', 200); if (!meeting.title?.trim()) invalid(`${meetingMonthNames[meeting.month - 1]} needs a meeting title.`);
      text(meeting.notes, 'Meeting notes', 2000);
      let prior = '', count = 0;
      for (let slot = 1; slot <= meetingTimeSlots; slot++) {
        const time = meeting[`time_${slot}`], label = meeting[`label_${slot}`];
        if (!present(time) && !present(label)) continue;
        if (!timePattern.test(time || '')) invalid(`${meetingMonthNames[meeting.month - 1]} has an invalid meeting time.`);
        text(label, 'Meeting time label', 100); if (!label?.trim()) invalid(`${meetingMonthNames[meeting.month - 1]} needs a label for every time.`);
        if (prior && time <= prior) invalid(`${meetingMonthNames[meeting.month - 1]} times must be listed from earliest to latest.`);
        prior = time; count++;
      }
      if (!count) invalid(`${meetingMonthNames[meeting.month - 1]} needs one to three meeting times.`);
    }
  }
}

export function formatMeetingTime(value) {
  if (!timePattern.test(String(value || ''))) return '';
  const [hour, minute] = value.split(':').map(Number), suffix = hour < 12 ? 'a.m.' : 'p.m.', displayHour = hour % 12 || 12;
  return `${displayHour}${minute ? ':' + pad(minute) : ''} ${suffix}`;
}

export function publicMeetingPlanEvents(row, payload, organization) {
  if (row?.id !== VFW_8151_ID || !Array.isArray(payload?.meeting_plans)) return [];
  const result = [];
  for (const plan of payload.meeting_plans) for (const meeting of Array.isArray(plan?.meetings) ? plan.meetings : []) {
    try {
      const times = Array.from({ length: meetingTimeSlots }, (_, index) => ({ time: meeting[`time_${index + 1}`], label: meeting[`label_${index + 1}`] })).filter(entry => entry.time && entry.label), first = times[0];
      if (!first) continue;
      result.push({
        id: `organization-meeting-${VFW_8151_ID}-${plan.year}-${pad(meeting.month)}`,
        title: meeting.title,
        organization_id: VFW_8151_ID,
        organizer: organization.verified_name,
        kind: 'Organization meeting',
        county: organization.location_county,
        city: organization.city || '',
        venue: organization.address?.text || 'Contact the post for the meeting location.',
        start_at: pacificToInstant(`${meeting.date}T${first.time}`),
        end_at: null,
        date_only: false,
        audience: organization.audience || 'Contact the post for attendance details.',
        description: meeting.notes || 'Monthly Post meeting.',
        meeting_times: times,
        source_url: organization.public_contacts?.website || '',
        source_checked: null,
        time_note: 'Published by VFW Post 8151 through its headquarters meeting planner.',
        source_kind: 'project_team',
        source_note: 'Published from the VFW Post 8151 monthly meeting planner.',
        status: 'published'
      });
    } catch { /* Invalid stored plan entries are omitted individually. */ }
  }
  return result;
}
