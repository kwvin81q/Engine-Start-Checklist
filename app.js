const screen = document.querySelector('#screen');
const path = document.querySelector('#path');
const sessionMarks = new Map();
const splitRoute = () => location.hash.slice(1).split('/');
const go = (...parts) => { location.hash = parts.join('/'); };

function element(tag, parent, label, className) {
  const node = document.createElement(tag);
  if (label) node.textContent = label;
  if (className) node.className = className;
  parent.append(node);
  return node;
}

function button(parent, label, action) {
  const node = element('button', parent, label);
  node.type = 'button';
  node.onclick = action;
  return node;
}

function choices(title, entries) {
  element('h2', screen, title);
  const grid = element('div', screen, '', 'choices');
  for (const [label, action] of entries) button(grid, label, action);
}

function readMarks(key) {
  if (sessionMarks.has(key)) return sessionMarks.get(key);
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function renderChecklist(group, list) {
  const key = 'mx-checklist-v1/' + group.key + '/' + list.label;
  const marks = readMarks(key);
  const count = list.pages.reduce((sum, page) => sum + page.rows.length, 0);
  let pageIndex = 0;
  element('h2', screen, list.label);
  element('p', screen, group.aircraft + ' · ' + group.engine);
  const progress = element('p', screen);
  progress.id = 'progress';
  progress.setAttribute('aria-live', 'polite');
  const controls = element('nav', screen);
  const previous = button(controls, '← Previous', () => { pageIndex--; renderPage(); });
  const next = button(controls, 'Next →', () => { pageIndex++; renderPage(); });
  const zoom = button(controls, 'Zoom in', () => {
    const enabled = scroll.classList.toggle('zoomed');
    zoom.textContent = enabled ? 'Fit width' : 'Zoom in';
  });
  const pdf = element('a', controls, 'Open original PDF ↗', 'link');
  pdf.href = list.pdf;
  pdf.target = '_blank';
  pdf.rel = 'noopener';
  const reset = button(controls, 'Reset marks', () => {
    if (!confirm('Clear your marks for this checklist?')) return;
    marks.clear();
    save();
    renderPage();
  });
  const scroll = element('div', screen, '', 'paper-scroll');
  const paper = element('div', scroll, '', 'paper');
  const pageNote = element('p', screen);

  function save() {
    sessionMarks.set(key, marks);
    try { localStorage.setItem(key, JSON.stringify([...marks])); } catch { /* Keep this session usable. */ }
  }

  function updateProgress() {
    progress.textContent = 'Page ' + (pageIndex + 1) + ' of ' + list.pages.length +
      ' · ' + marks.size + ' of ' + count + ' markers checked';
    reset.disabled = !marks.size;
  }

  function renderPage() {
    const page = list.pages[pageIndex];
    paper.replaceChildren();
    const image = element('img', paper);
    image.src = page.image;
    image.alt = list.label + ', original PDF page ' + page.number;
    for (const [index, [position, text]] of page.rows.entries()) {
      const id = page.number + '/' + index;
      const marker = button(paper, '', () => {
        if (marks.has(id)) marks.delete(id);
        else marks.add(id);
        updateMarker();
        save();
        updateProgress();
      });
      marker.className = 'mark';
      marker.style.top = position + '%';
      marker.setAttribute('aria-label', text);
      marker.title = text;
      function updateMarker() {
        const checked = marks.has(id);
        marker.textContent = checked ? '✓' : '□';
        marker.setAttribute('aria-pressed', checked);
      }
      updateMarker();
    }
    pageNote.textContent = page.rows.length ? '' : 'This page has no item markers. Read the full page before continuing.';
    previous.disabled = pageIndex === 0;
    next.disabled = pageIndex + 1 === list.pages.length;
    updateProgress();
  }
  renderPage();
}

function render() {
  const [aircraft, engine, checklist] = splitRoute().map(part => {
    try { return decodeURIComponent(part); } catch { return ''; }
  });
  const groups = fleet.filter(group => group.aircraft === aircraft);
  const group = groups.find(entry => entry.key === engine);
  const list = group?.lists.find(entry => entry.label === checklist);
  path.replaceChildren();
  screen.replaceChildren();
  if (!groups.length) {
    choices('Choose aircraft', [...new Set(fleet.map(group => group.aircraft))].map(name => [name, () => go(name)]));
    return;
  }
  button(path, '← Aircraft', () => go());
  if (!group) {
    choices(aircraft + ' · Choose engine', groups.map(entry => [entry.engine, () => go(aircraft, entry.key)]));
    return;
  }
  button(path, '← Engine', () => go(aircraft));
  if (!list) {
    choices(aircraft + ' · ' + group.engine, group.lists.map(entry =>
      [entry.label, () => go(aircraft, group.key, encodeURIComponent(entry.label))]));
    return;
  }
  button(path, '← Checklists', () => go(aircraft, engine));
  renderChecklist(group, list);
}
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
render();
