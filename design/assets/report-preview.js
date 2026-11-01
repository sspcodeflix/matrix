/* Local design demonstration only. No API calls, permissions or real exports. */
(() => {
  const dialog = document.querySelector('.dl');
  if (!dialog) return;
  const form = dialog.querySelector('form');
  const feedback = document.querySelector('#export-feedback');
  const generate = document.querySelector('#generate-report');
  const list = dialog.querySelector('.dl-jobs');
  const jobs = new Map();
  let sequence = 50;
  let creating = false;
  const types = [...form.querySelectorAll('[name=type]')];
  const formats = [...form.querySelectorAll('[name=fmt]')];
  const scopes = [...form.querySelectorAll('[name=scope]')];
  types.forEach((input, i) => { input.value = ['coverage', 'test-cases'][i]; });
  formats.forEach((input, i) => { input.value = ['pdf', 'html', 'xlsx'][i]; });
  scopes.forEach((input, i) => { input.value = ['selected', 'filtered', 'all'][i]; });
  const current = name => form.querySelector(`[name=${name}]:checked`).value;
  const keyFor = job => [job.type, job.format, job.scope, job.snapshot].join('|');
  const say = message => { feedback.textContent = message; };
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function action(label, handler) {
    const button = element('button', label, 'dl-btn small');
    button.type = 'button'; button.addEventListener('click', handler); return button;
  }
  function render(job) {
    const card = job.card;
    card.replaceChildren();
    const heading = element('div', '', 'dl-job-top');
    heading.append(element('strong', `${job.title} · ${job.format.toUpperCase()}`), element('span', job.state, `chip ${job.state === 'Ready' ? 'ok' : 'neutral'}`));
    card.append(heading, element('span', `${job.snapshot} · ${job.scope} scope · ${job.asOf}`, 'dl-meta'));
    const filename = `matrix_payments-hub_${job.type}_${job.snapshot}_${job.stamp}_${job.id}.${job.format}`;
    card.append(element('code', filename, 'dl-filename'));
    const actions = element('div', '', 'dl-actions');
    if (job.state === 'Queued' || job.state === 'Generating') {
      actions.append(action('Cancel export', () => {
        job.timers.forEach(clearTimeout); job.state = 'Cancelled'; render(job); say('Example export cancelled. Its saved source snapshot is retained.');
      }));
    }
    if (job.state === 'Ready') {
      const samples = element('a', 'View sample files', 'dl-btn small sample-pack');
      samples.href = '../report-samples/index.html'; actions.append(samples);
      if (job.type !== 'test-cases') {
        const picker = element('select'); picker.setAttribute('aria-label', `Companion format for ${job.id}`);
        ['pdf', 'html', 'xlsx'].filter(format => format !== job.format).forEach(format => {
          const option = element('option', format.toUpperCase()); option.value = format; picker.append(option);
        });
        actions.append(picker, action('Another format, same snapshot', () => request({...job, format: picker.value})));
      }
    }
    card.append(actions);
  }
  function request(input) {
    const key = keyFor(input);
    const existing = jobs.get(key);
    if (existing && ['Queued', 'Generating', 'Ready'].includes(existing.state)) {
      existing.card.scrollIntoView({block: 'nearest'}); existing.card.focus();
      say(`Existing ${existing.state.toLowerCase()} export ${existing.id} selected. No duplicate job was created.`); return;
    }
    const job = {...input, id: `RPT-${++sequence}`, state: 'Queued', timers: [], card: element('li', '', 'dl-job')};
    job.card.tabIndex = -1; job.card.dataset.snapshot = job.snapshot; list.prepend(job.card); jobs.set(key, job); render(job);
    say(`Example export ${job.id} queued using ${job.snapshot}. No production job has been started.`);
    job.timers.push(setTimeout(() => { job.state = 'Generating'; render(job); }, 500));
    job.timers.push(setTimeout(() => { job.state = 'Ready'; render(job); say(`Example ${job.id} is ready. Sample files illustrate the output layouts.`); }, 1600));
  }
  function selection() {
    return {type: current('type'), title: current('type') === 'coverage' ? 'Coverage and gaps' : 'Test cases', format: current('fmt'), scope: current('scope'), snapshot: 'S-022', asOf: '1 Nov 2026, 09:42 UTC', stamp: '20261101T094200Z'};
  }
  function refresh() {
    const tests = current('type') === 'test-cases';
    formats.forEach(input => { input.disabled = tests && input.value !== 'xlsx'; input.closest('label').classList.toggle('disabled', input.disabled); });
    if (tests) formats[2].checked = true;
    generate.textContent = `Generate ${current('fmt').toUpperCase()}`;
    const all = current('scope') === 'all';
    const values = form.querySelectorAll('.dl-preview dd');
    values[1].textContent = all ? 'Entire permitted application scope; current filters excluded' : 'View: Gaps · Repo: pay-hub-automation@main';
    values[2].textContent = tests ? (all ? '31 illustrative test cases mapped to 38 requirements; 7 requirements have no cases' : '4 illustrative test cases mapped to the 11 gaps; 7 gaps have no cases') : all ? '38 requirements in scope: 27 covered, 7 no test, 4 not automated' : '11 gaps in scope: 7 no test, 4 not automated';
    values[4].textContent = tests ? 'Summary, Test cases, ordered Steps and Sources; review states included' : 'Summary, gaps by type and module, traceability, citations, counting rules v1';
  }
  form.addEventListener('change', refresh);
  form.addEventListener('submit', event => event.preventDefault());
  generate.addEventListener('click', () => {
    if (creating) return;
    creating = true; generate.disabled = true; generate.textContent = 'Creating export…';
    const input = selection();
    setTimeout(() => { request(input); creating = false; generate.disabled = false; refresh(); }, 250);
  });
  dialog.querySelectorAll('[data-export-action]').forEach(button => button.addEventListener('click', () => {
    const actionName = button.dataset.exportAction;
    if (actionName === 'sample') { window.location.href = '../report-samples/index.html'; return; }
    if (actionName === 'cancel') { button.closest('li').querySelector('.chip').textContent = 'Cancelled'; button.disabled = true; say('Example export cancelled.'); return; }
    const original = actionName === 'original';
    if (actionName === 'updated') {
      const card = button.closest('li');
      if (card.querySelector('[data-updated-preview]')) return;
      const preview = element('div', '', 'dl-actions'); preview.dataset.updatedPreview = 'true';
      preview.append(element('p', 'Updated report preview: Run #4790, latest recorded results as of 1 Nov 2026, 10:00 UTC. The historical snapshot remains unchanged.', 'dl-meta'));
      preview.append(action('Generate updated PDF', () => request({type: 'run-results', title: 'Updated run results', format: 'pdf', scope: 'run-4790', snapshot: 'RUN-4790-updated', asOf: '1 Nov 2026, 10:00 UTC', stamp: '20261101T100000Z'})));
      card.append(preview); preview.querySelector('button').focus(); say('Updated scope and capture time shown. Generate explicitly to create the new report.'); return;
    }
    request({type: original ? 'run-results' : 'comparison', title: original ? 'Run results' : 'Scan comparison', format: 'pdf', scope: 'original', snapshot: original ? 'RUN-4790' : 'S-014-to-S-022', asOf: original ? '30 Oct 2026, 09:00 UTC' : '1 Nov 2026, 09:42 UTC', stamp: original ? '20261030T090000Z' : '20261101T094200Z'});
  }));
  // Register the already visible generating example so it also participates in deduplication.
  const running = {type: 'coverage', title: 'Coverage and gaps', format: 'html', scope: 'filtered', snapshot: 'S-022', asOf: '1 Nov 2026, 09:42 UTC', stamp: '20261101T094200Z', id: 'RPT-039', state: 'Generating', timers: [], card: list.querySelector('li')};
  running.card.tabIndex = -1; running.card.dataset.snapshot = running.snapshot; jobs.set(keyFor(running), running); render(running);
  // Seed a ready coverage report to demonstrate companion formats without recapturing data.
  const saved = {type: 'coverage', title: 'Coverage and gaps', format: 'pdf', scope: 'all', snapshot: 'S-021', asOf: '31 Oct 2026, 16:10 UTC', stamp: '20261031T161000Z', id: 'RPT-040', state: 'Ready', timers: [], card: element('li', '', 'dl-job')};
  saved.card.tabIndex = -1; saved.card.dataset.snapshot = saved.snapshot; list.prepend(saved.card); jobs.set(keyFor(saved), saved); render(saved);
  // This reference uses page navigation for Close; the production dialog restores its invoking focus.
  const scrim = dialog.closest('.dl-scrim');
  [...document.body.children].filter(node => node !== scrim && !['SCRIPT', 'STYLE', 'LINK'].includes(node.tagName)).forEach(node => { node.inert = true; });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); dialog.querySelector('.dl-x').click(); }
    if (event.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('a[href],button,input,select,[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.querySelector('.sample-pack').href = '../report-samples/index.html';
  refresh(); types[0].focus();
})();
