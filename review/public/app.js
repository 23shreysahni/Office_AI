const main = document.querySelector('main');
const dialog = document.querySelector('#source-dialog');
let data;
const names = { overview: 'Overview', documents: 'Source examples', assistants: 'Assistant drafts', accounts: 'Accounts', readiness: 'Readiness' };
const departmentNames = { editorial: 'Editorial', hr: 'HR', sales: 'Sales' };
const node = (tag, className = '', text) => {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
};
const append = (parent, ...children) => { parent.append(...children); return parent; };
const link = (text, href, className = 'text-link') => {
  const result = node('a', className, text); result.href = href; return result;
};
function fileLink(key, text) {
  const result = link(text, `/review-files/${key}`);
  result.target = '_blank'; result.rel = 'noopener'; return result;
}
function heading(kicker, title, description, action) {
  const copy = append(node('div'), node('p', 'eyebrow', kicker), node('h1', '', title), node('p', 'subtle', description));
  const section = append(node('div', 'page-top'), copy);
  if (action) section.append(action);
  main.append(section);
}
function notice(title, text) {
  return append(node('aside', 'notice'), node('span', 'symbol', '◈'), append(node('div'), node('strong', '', title), node('p', '', text)));
}
function card(icon, title, description, destination, foot) {
  const result = link('', destination, 'feature-card');
  return append(result, node('span', 'card-icon', icon), node('h3', '', title), node('p', '', description), append(node('div', 'card-footer'), node('span', '', foot), node('span', '', '↗')));
}
function overview() {
  heading('YOUR WORKSPACE, AT A GLANCE', 'Welcome to Office AI', 'A local look at the workspace taking shape.', link('Review readiness ↗', '#readiness', 'button'));
  const copy = append(node('div', 'hero-copy'), node('p', 'eyebrow', 'LOCAL OFFICE AI'), node('h2', '', 'Company knowledge.\nCloser to home.'), node('p', 'description', 'Explore the proposed source library and department assistants, built around private, local inference.'), link('Explore the review →', '#documents', 'button primary'));
  const visual = node('div', 'hero-visual'); visual.setAttribute('aria-hidden', 'true');
  append(visual, node('div', 'orbit'), append(node('div', 'orbit-card'), node('span', 'little-icon', '✳'), node('strong', '', 'Office intelligence'), node('small', '', 'Designed to stay local'), node('div', 'mini-line'), node('div', 'mini-line short')), node('div', 'float-chip', '◇  Read-only preview'));
  main.append(append(node('section', 'hero'), copy, visual));
  const stats = node('div', 'stat-grid');
  for (const [label, value, unit, note] of [
    ['Synthetic sources', String(data.documents.length).padStart(2, '0'), 'examples', 'Original fictional text'],
    ['Department assistants', '03', 'drafts', 'Instructions prepared'],
    ['Evaluation cases', String(data.evaluationCases.retrieval + data.evaluationCases.assistants), 'prepared', 'No model evaluations run']
  ]) stats.append(append(node('section', 'stat'), node('p', 'stat-label', label), append(node('div', 'stat-value', value), node('span', '', unit)), node('p', 'stat-note', note)));
  main.append(stats, append(node('div', 'section-heading'), node('h2', '', 'Explore your workspace'), link('View all phase gates →', '#readiness')));
  main.append(append(node('div', 'card-grid'),
    card('▤', 'Source examples', 'Browse the original fictional material prepared for future retrieval tests.', '#documents', 'Read-only source previews'),
    card('✳', 'Assistant drafts', 'Review the proposed Editorial, HR and Sales instructions and example copy.', '#assistants', 'Three department profiles'),
    card('◷', 'Implementation readiness', 'See what is prepared, what is unimplemented and which checks remain.', '#readiness', 'Six phase gates open')));
  main.append(notice('A review link, with clear boundaries', data.notice));
}
function openSource(source) {
  document.querySelector('#source-title').textContent = source.title;
  const body = document.querySelector('#source-body'); body.replaceChildren();
  body.append(node('p', 'subtle', `${departmentNames[source.department]} · Original fictional test material. Not an uploaded or indexed document.`));
  for (const section of source.sections) body.append(append(node('section', 'source-section'), node('h3', '', section.title), node('p', '', section.text)));
  dialog.showModal();
}
function documents() {
  heading('SOURCE EXAMPLES', 'A starting point for company knowledge', 'Original synthetic text, ready for future ingestion and retrieval tests.');
  const toolbar = node('div', 'toolbar'), search = node('input', 'search');
  search.type = 'search'; search.placeholder = 'Find a source example…'; search.setAttribute('aria-label', 'Search synthetic source examples');
  const filters = node('div', 'filters'); filters.setAttribute('aria-label', 'Filter examples by department');
  const grid = node('div', 'card-grid'), count = node('span', 'count'); count.setAttribute('role', 'status');
  let selected = 'all';
  const buttons = [];
  function update() {
    const term = search.value.trim().toLocaleLowerCase('en-GB');
    const sources = data.documents.filter(source => (selected === 'all' || source.department === selected) && `${source.title} ${source.sections.map(s => s.text).join(' ')}`.toLocaleLowerCase('en-GB').includes(term));
    count.textContent = `${sources.length} source ${sources.length === 1 ? 'example' : 'examples'}`;
    grid.replaceChildren();
    for (const source of sources) {
      const button = node('button', 'button', 'Read source ↗'); button.addEventListener('click', () => openSource(source));
      grid.append(append(node('article', 'document-card'), append(node('div', 'doc-top'), node('span', 'doc-symbol', '▤'), node('span', 'badge', departmentNames[source.department])), node('h2', '', source.title), node('p', '', `${source.sections.length} ${source.sections.length === 1 ? 'section' : 'sections'} · Synthetic fixture only`), button));
    }
    if (!sources.length) grid.append(node('p', 'empty', 'No examples match. Try another search or department.'));
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === selected));
  }
  for (const [key, label] of [['all', 'All examples'], ...Object.entries(departmentNames)]) {
    const button = node('button', 'filter', label);
    button.addEventListener('click', () => { selected = key; update(); });
    buttons.push([key, button]); filters.append(button);
  }
  search.addEventListener('input', update);
  main.append(append(toolbar, search, filters), append(node('div', 'section-heading'), node('h2', '', 'The synthetic library'), count), grid, notice('Examples only', 'No files have been uploaded, extracted or indexed. Department filters organise these examples; they do not simulate authentication or access control.'));
  update();
}
function assistants() {
  heading('DEPARTMENT ASSISTANTS', 'A little more focus for every team', 'Proposed instructions and illustrative copy. No AI generation is connected.');
  const tabs = node('div', 'tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Department instruction drafts');
  const region = node('div'); region.id = 'profile-panel'; region.setAttribute('role', 'tabpanel');
  const buttons = [];
  function select(index) {
    const profile = data.profiles[index];
    for (let i = 0; i < buttons.length; i++) { buttons[i].setAttribute('aria-selected', String(i === index)); buttons[i].tabIndex = i === index ? 0 : -1; }
    region.setAttribute('aria-labelledby', `tab-${profile.id}`);
    const list = node('ul', 'task-list'); for (const task of profile.tasks) list.append(node('li', '', task));
    const summary = append(node('section', 'panel'), node('span', 'card-icon', '✳'), node('h2', '', `${profile.label} assistant`), node('p', '', profile.description), list, node('span', 'badge draft', 'Instruction draft · not deployed'));
    const example = append(node('section', 'panel'), node('h3', 'example-label', 'ILLUSTRATIVE COPY · NOT AI-GENERATED'), node('blockquote', 'example-text', profile.example), node('p', 'source-label', `Fictional source: ${profile.source}`));
    const details = append(node('details', 'instruction-details'), node('summary', '', 'Review the proposed instructions'), node('pre', '', profile.instructions));
    region.replaceChildren(append(node('div', 'assistant-layout'), summary, example), details);
  }
  data.profiles.forEach((profile, index) => {
    const button = node('button', 'tab', profile.label); button.id = `tab-${profile.id}`;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'profile-panel');
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % data.profiles.length;
      if (event.key === 'ArrowLeft') next = (index + data.profiles.length - 1) % data.profiles.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = data.profiles.length - 1;
      if (next !== undefined) { event.preventDefault(); select(next); buttons[next].focus(); }
    });
    buttons.push(button); tabs.append(button);
  });
  main.append(tabs, region, notice('Grounded drafts, after the permission gate', 'Live assistants require working authentication, approved collection grants and verified retrieval. Outputs will require human review. Messages and external actions are never sent automatically.'));
  select(0);
}
function readiness() {
  heading('IMPLEMENTATION READINESS', 'An honest view of what is ready', 'Prepared specifications do not count as implemented or accepted phases.', fileLink('evidence', 'Read foundation evidence ↗'));
  main.append(notice('0 of 6 implementation phases accepted', 'The foundation still needs actual-host acceptance. Later services are not implemented. This review interface does not change those results.'));
  const phases = node('div', 'phases');
  for (const phase of data.phases) {
    const copy = append(node('div'), node('h2', '', phase.name), node('p', '', phase.detail));
    if (phase.file) copy.append(fileLink(phase.file, 'Read specification ↗'));
    phases.append(append(node('article', 'phase'), node('span', 'phase-number', String(phase.number).padStart(2, '0')), copy, node('span', `badge ${phase.kind}`, phase.status)));
  }
  main.append(phases, append(node('div', 'next-steps'),
    append(node('section', 'panel'), node('h2', '', 'Next: verify the Windows host'), node('p', '', 'Start a working Docker Desktop Linux engine and Ubuntu WSL environment. Complete offline chat, network, TLS, reboot and restore checks on the actual host.'), fileLink('windows', 'Open Windows setup ↗')),
    append(node('section', 'panel'), node('h2', '', 'Then: implement identity and permissions'), node('p', '', 'Confirm an internally available sign-in provider, implement the accepted identity design and verify department isolation before adding document access.'), fileLink('identity', 'Read the identity proposal ↗'))));
}
function accounts() {
  heading('ACCOUNTS', 'A controlled workflow, with people in charge', 'No financial data or calculations are connected to this review.');
  const list = node('ul');
  for (const item of ['Accepted identity and departmental permissions', 'Reviewed decimal precision and rounding rules', 'Independent reconciliation and negative permission tests', 'Human financial review before release']) list.append(node('li', '', item));
  main.append(append(node('section', 'panel accounts-panel'), node('span', 'card-icon', '≋'), node('span', 'badge closed', 'Phase 5 · not implemented'), node('h2', 'section-gap', 'Accounts is awaiting its safety gate.'), node('p', '', 'Imports, party-wise summaries and proposed reconciliation are planned. No bank or ERP write-back, approval action or real financial import is available.'), list, link('View the required steps →', '#readiness', 'button')));
}
function render(focus = false) {
  if (!data) return;
  const candidate = location.hash.slice(1), page = Object.hasOwn(names, candidate) ? candidate : 'overview';
  document.querySelector('#breadcrumb').textContent = names[page];
  document.title = `${names[page]} · Office AI local review`;
  for (const anchor of document.querySelectorAll('[data-page]')) {
    if (anchor.dataset.page === page) anchor.setAttribute('aria-current', 'page'); else anchor.removeAttribute('aria-current');
  }
  main.replaceChildren();
  ({ overview, documents, assistants, accounts, readiness })[page]();
  if (focus) { main.focus(); window.scrollTo(0, 0); }
}
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); main.focus(); main.scrollIntoView(); });
window.addEventListener('hashchange', () => render(true));
try {
  const response = await fetch('/api/review', { cache: 'no-store' });
  if (!response.ok) throw new Error();
  data = await response.json(); render();
} catch {
  main.replaceChildren(append(node('div', 'error'), node('h1', '', 'The local review is unavailable'), node('p', '', 'Check that the review server is running, then reload. No AI or company data is connected.')));
}
