// The shell injects supported list interfaces; this screen never imports feature internals.
export function createFeature(sources) {
  return { kind: 'overview', title: 'Your headquarters', connect({ $, api, navigate }) {
    return { async render({ isCurrent }) {
        const values = await Promise.all(sources.map(feature => feature.summary ? feature.summary(api) : feature.list(api)));
        if (!isCurrent()) return;
        const [requests, tasks, orgs] = values;
        const total = (value, excluded=[]) => Array.isArray(value) ? value.filter(row=>!excluded.includes(row.status)).length : Object.entries(value.counts||{}).reduce((sum,[status,count])=>sum+(excluded.includes(status)?0:count),0);
        $('content').innerHTML = `<div class="stats"><div class="stat"><b>${total(requests,['completed','closed','cancelled'])}</b>Open requests</div><div class="stat"><b>${total(tasks,['completed','closed'])}</b>Project items</div><div class="stat"><b>${total(orgs)}</b>Organization profiles</div></div><div class="panel"><h2>A shared home for the work between meetings.</h2><p>Use Requests to record changes, research, or ideas. Review public submissions and verify information before publishing profiles or events.</p><button type="button" id="goRequests">Open Requests</button></div>`;
        $('goRequests').onclick = () => navigate('request');

    } };
  } };
}
