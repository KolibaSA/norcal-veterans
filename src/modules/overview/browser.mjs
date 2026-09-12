// The shell injects supported list interfaces; this screen never imports feature internals.
export function createFeature(sources) {
  return { kind: 'overview', title: 'Your headquarters', connect({ $, api, navigate }) {
    return { async render({ isCurrent }) {
        const values = await Promise.all(sources.map(feature => feature.list(api)));
        if (!isCurrent()) return;
        const [requests, tasks, orgs] = values;
        $('content').innerHTML = `<div class="stats"><div class="stat"><b>${requests.filter(x => !['completed', 'closed', 'cancelled'].includes(x.status)).length}</b>Open requests</div><div class="stat"><b>${tasks.filter(x => !['completed', 'closed'].includes(x.status)).length}</b>Project items</div><div class="stat"><b>${orgs.length}</b>Organization profiles</div></div><div class="panel"><h2>A shared home for the work between meetings.</h2><p>Use Requests to record changes, research, or ideas. Review public submissions and verify information before publishing profiles or events.</p><button type="button" id="goRequests">Open Requests</button></div>`;
        $('goRequests').onclick = () => navigate('request');

    } };
  } };
}
