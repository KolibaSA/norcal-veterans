// Minimal injected DOM controls for controller unit tests. Full browser startup
// and native form/focus behavior are verified with the synthetic /hq fixture.
export function controls() {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', checked: false, hidden: false, disabled: false, innerHTML: '', textContent: '', dataset: {},
      options: [], files: [], querySelector: () => null, querySelectorAll: () => [],
      reset() { this.resets = (this.resets ?? 0) + 1; },
      insertAdjacentHTML(position, html) { this.innerHTML = position === 'afterbegin' ? html + this.innerHTML : this.innerHTML + html; },
      add(option) { this.options.push(option); }
    });
    return elements.get(id);
  };
  return { $, elements };
}
export const submitEvent = () => ({ preventDefault() {}, submitter: { disabled: false } });
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
