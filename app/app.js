/* Marsam — editor logic.
   A classic script (not an ES module) so the page also runs when opened straight from disk (file://).
   Inside the desktop app, electron/preload.js exposes `window.marsamNative` for files, PDF and updates. */
'use strict';
(async function () {
const MERMAID_SRC = 'vendor/mermaid.min.js';
const REPO_URL = 'https://github.com/Obsidian-Strike/marsam';

/* ================= Helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (id, cls = 'ico sm') => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const inArtifact = () => typeof window.claude?.use === 'function';
const native = window.marsamNative || null;
const store = {
  get(k, d) { try { const v = localStorage.getItem('marsam:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('marsam:' + k, JSON.stringify(v)); return true; } catch { return false; } },
};
function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const safeName = n => (n || 'diagram').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'diagram';
const norm = s => String(s ?? '').replace(/\r\n?/g, '\n').trimEnd();
const baseName = p => String(p).split(/[\\/]/).pop();
const stripExt = n => n.replace(/\.(mmd|mermaid|md|markdown|txt|json)$/i, '');
const TEXT_FILE_RE = /\.(mmd|mermaid|txt)$/i;
const samePath = (a, b) => native?.platform === 'win32' || native?.platform === 'darwin' ? a.toLowerCase() === b.toLowerCase() : a === b;
const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

/* ================= Settings & language ================= */
const FONTS = {
  ibm: { css: '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif', family: 'IBM Plex Sans Arabic' },
  kufi: { css: '"Noto Kufi Arabic", "Segoe UI", Tahoma, sans-serif', family: 'Noto Kufi Arabic' },
  mono: { css: '"JetBrains Mono", "IBM Plex Sans Arabic", monospace', family: 'JetBrains Mono' },
  classic: { css: '"trebuchet ms", verdana, arial, sans-serif', family: null },
  system: { css: 'system-ui, "Segoe UI", Tahoma, Arial, sans-serif', family: null },
};
const BASE_VARS = [
  ['primaryColor', 'bvPrimary', '#E7ECFC'],
  ['primaryTextColor', 'bvPrimaryText', '#141923'],
  ['primaryBorderColor', 'bvBorder', '#2B4ACB'],
  ['lineColor', 'bvLine', '#5B6474'],
  ['secondaryColor', 'bvSecondary', '#FDEBDD'],
  ['tertiaryColor', 'bvTertiary', '#EAF6EF'],
];
const DEFAULTS = {
  lang: 'ar', uiTheme: 'system', theme: 'auto', look: 'classic', layout: 'auto', curve: 'basis', font: 'ibm', htmlLabels: true,
  baseVars: Object.fromEntries(BASE_VARS.map(([k, , v]) => [k, v])),
  bg: 'dots', fontSize: 14, wrap: false, autoRender: true, delay: 350,
  pngScale: 2, pngBg: 'theme', viewLayout: 'split-h', split: 0.42, sideOpen: true, panel: 'docs', autoUpdate: true,
};
const settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
settings.baseVars = Object.assign({}, DEFAULTS.baseVars, settings.baseVars || {});
if (!I18N[settings.lang]) settings.lang = 'ar';
const saveSettings = () => store.set('settings', settings);

let LANG = settings.lang;
function t(key, params) {
  let s = I18N[LANG][key];
  if (s == null) s = I18N.ar[key] ?? key;
  return params ? s.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '') : s;
}
// Pick the current-language variant of { ar, en } content; plain strings are shared.
const L = v => (v && typeof v === 'object') ? (v[LANG] ?? v.ar) : v;
let rtf = null;
function ago(time) {
  const s = (time - Date.now()) / 1000, a = Math.abs(s);
  if (a < 45) return t('justNow');
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(time).toLocaleDateString(LANG === 'ar' ? 'ar-u-nu-latn' : 'en');
}

/* ================= Content ================= */
const TPL = Object.fromEntries(MARSAM_TEMPLATES.map(tp => [tp.key, tp]));
function detectType(code) {
  const body = code.replace(/^\s*---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, '').replace(/%%\{[\s\S]*?\}%%/g, '');
  const line = body.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('%%'));
  if (!line) return null;
  const kw = line.split(/[\s:;{]/)[0];
  const hit = MARSAM_TYPES.find(([re]) => re.test(kw));
  return { kw, label: hit ? L(hit[1]) : null, snip: hit ? hit[2] : null };
}

/* ================= Documents state ================= */
let docs = store.get('docs', null);
if (!Array.isArray(docs) || !docs.length) {
  const now = Date.now();
  docs = MARSAM_SEEDS.map(s => ({ id: uid(), name: L(s.name), code: L(TPL[s.tpl].code), created: now, updated: now - s.age }));
}
let currentId = store.get('current', docs[0].id);
if (!docs.some(d => d.id === currentId)) currentId = docs[0].id;
const cur = () => docs.find(d => d.id === currentId);
const isFileDirty = d => !!d?.path && d.code !== d.fileCode;

const app = $('#app'), work = $('#work'), canvas = $('#canvas'), stage = $('#stage');
const isNarrow = () => matchMedia('(max-width: 820px)').matches;

/* ================= Toasts ================= */
function toast(msg, opts = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  if (opts.kind) el.dataset.kind = opts.kind;
  el.innerHTML = `<span>${esc(msg)}</span>`;
  if (opts.action) {
    const b = document.createElement('button');
    b.textContent = opts.action.label;
    b.onclick = () => { opts.action.fn(); el.remove(); };
    el.appendChild(b);
  }
  const host = $('#toasts');
  host.appendChild(el);
  while (host.children.length > 3) host.firstChild.remove();
  setTimeout(() => el.remove(), opts.ms || (opts.action ? 6000 : 2600));
}

/* ================= CodeMirror ================= */
const KEYWORDS = ['subgraph', 'end', 'direction', 'classDef', 'class', 'style', 'linkStyle', 'click', 'call', 'href',
  'participant', 'actor', 'as', 'loop', 'alt', 'else', 'opt', 'par', 'and', 'critical', 'break', 'rect', 'Note', 'note',
  'over', 'left of', 'right of', 'end note', 'activate', 'deactivate', 'autonumber', 'box', 'create', 'destroy', 'link', 'links',
  'state', 'title', 'section', 'dateFormat', 'axisFormat', 'tickInterval', 'excludes', 'includes', 'todayMarker', 'weekday',
  'weekend', 'showData', 'accTitle', 'accDescr', 'commit', 'branch', 'checkout', 'switch', 'merge', 'cherry-pick', 'tag',
  'order', 'namespace', 'x-axis', 'y-axis', 'quadrant-1', 'quadrant-2', 'quadrant-3', 'quadrant-4', 'bar', 'line',
  'columns', 'space', 'group', 'service', 'junction', 'root', 'requirement', 'functionalRequirement', 'interfaceRequirement',
  'performanceRequirement', 'physicalRequirement', 'designConstraint', 'element', 'satisfies', 'traces', 'contains',
  'copies', 'derives', 'refines', 'verifies', 'risk', 'verifymethod', 'docref', 'axis', 'curve', 'max', 'min',
  'showLegend', 'set', 'union', 'anchor', 'component', 'evolve', 'pipeline', 'systemBoundary', 'Person', 'Person_Ext',
  'System', 'System_Ext', 'SystemDb', 'SystemQueue', 'Container', 'ContainerDb', 'Component', 'Boundary',
  'Enterprise_Boundary', 'System_Boundary', 'Container_Boundary', 'Rel', 'BiRel', 'Rel_U', 'Rel_D', 'Rel_L', 'Rel_R',
  'UpdateRelStyle', 'UpdateElementStyle', 'UpdateLayoutConfig', 'shape', 'label', 'icon', 'complex', 'complicated',
  'clear', 'chaotic', 'confusion', 'flow'];
const HEADERS = MARSAM_HEAD_RE.source.match(/\(([^)]+)\)/)[1].split('|');
const KW_RE = new RegExp('(?:' + [...KEYWORDS].sort((a, b) => b.length - a.length).map(reEsc).join('|') + ')(?![\\w-])');
const HEAD_TOKEN_RE = new RegExp('(?:' + HEADERS.map(reEsc).join('|') + ')(?![\\w-])');

CodeMirror.defineSimpleMode('mermaid', {
  start: [
    { regex: /---\s*$/, sol: true, token: 'meta', next: 'front' },
    { regex: /%%\{/, token: 'meta', next: 'directive' },
    { regex: /%%.*/, token: 'comment' },
    { regex: /"(?:[^"\\]|\\.)*"?/, token: 'string' },
    { regex: /`[^`]*`?/, token: 'string-2' },
    { regex: /(?:\|\||\|o|\}\||\}o)(?:--|\.\.)(?:\|\||o\||\|\{|o\{)/, token: 'operator' },
    { regex: /<\|--|--\|>|\.\.\|>|<\|\.\.|\*--|--\*|o--|--o(?![\w؀-ۿ])/, token: 'operator' },
    { regex: /<?(?:-{2,}|={2,}|-\.+-|~{3,})(?:>|x(?![\w])|o(?![\w]))?|-{1,2}>>|-{1,2}[x)]|->|<->|\.\.>|\.\./, token: 'operator' },
    { regex: /\|[^|\n]*\|/, token: 'string-2' },
    { regex: HEAD_TOKEN_RE, token: 'header' },
    { regex: /(?:TB|TD|BT|RL|LR)(?![\w-])/, token: 'atom' },
    { regex: KW_RE, token: 'keyword' },
    { regex: /:::\s*[\w-]+/, token: 'variable-2' },
    { regex: /#[0-9a-fA-F]{3,8}(?![\w])/, token: 'number' },
    { regex: /-?\d+(?:\.\d+)?(?:px|%|d|w|h|ms|s)?(?![\w؀-ۿ])/, token: 'number' },
    { regex: /[\[\](){}]/, token: 'bracket' },
    { regex: /[:;,@]/, token: 'punctuation' },
    { regex: /[\w؀-ۿݐ-ݿ][\w؀-ۿݐ-ݿ.-]*/, token: null },
  ],
  front: [
    { regex: /---\s*$/, sol: true, token: 'meta', next: 'start' },
    { regex: /\s*[\w-]+(?=\s*:)/, sol: true, token: 'attribute' },
    { regex: /:/, token: 'punctuation' },
    { regex: /.+/, token: 'string' },
  ],
  directive: [
    { regex: /.*?\}%%/, token: 'meta', next: 'start' },
    { regex: /.+/, token: 'meta' },
  ],
  meta: { lineComment: '%%' },
});

function mermaidHint(ed) {
  const c = ed.getCursor(), line = ed.getLine(c.line);
  let s = c.ch;
  while (s > 0 && /[\w\-؀-ۿ]/.test(line[s - 1])) s--;
  const word = line.slice(s, c.ch).toLowerCase();
  const pool = new Set([...HEADERS, ...KEYWORDS, 'TB', 'TD', 'LR', 'RL', 'BT']);
  for (const m of ed.getValue().matchAll(/[A-Za-z_][\w-]{2,}/g)) pool.add(m[0]);
  const list = [...pool].filter(w => w.toLowerCase().startsWith(word) && w.toLowerCase() !== word)
    .sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, 40);
  return { list, from: CodeMirror.Pos(c.line, s), to: CodeMirror.Pos(c.line, c.ch) };
}
CodeMirror.commands.autocomplete = ed => ed.showHint({ hint: mermaidHint, completeSingle: false, container: app });

function moveLines(ed, dir) {
  const from = ed.getCursor('from'), to = ed.getCursor('to');
  const start = from.line;
  let end = to.line;
  if (to.ch === 0 && end > start) end--;
  if ((dir < 0 && start === 0) || (dir > 0 && end >= ed.lastLine())) return;
  const a = dir < 0 ? start - 1 : start, b = dir < 0 ? end : end + 1;
  const lines = ed.getRange(CodeMirror.Pos(a, 0), CodeMirror.Pos(b, ed.getLine(b).length)).split('\n');
  const moved = dir < 0 ? lines.slice(1).concat(lines[0]) : [lines[lines.length - 1]].concat(lines.slice(0, -1));
  ed.operation(() => {
    ed.replaceRange(moved.join('\n'), CodeMirror.Pos(a, 0), CodeMirror.Pos(b, ed.getLine(b).length));
    ed.setSelection(CodeMirror.Pos(from.line + dir, from.ch), CodeMirror.Pos(to.line + dir, to.ch));
  });
}
function duplicateLine(ed) {
  const c = ed.getCursor(), text = ed.getLine(c.line);
  ed.replaceRange('\n' + text, CodeMirror.Pos(c.line, text.length));
  ed.setCursor(CodeMirror.Pos(c.line + 1, c.ch));
}

// One CodeMirror document per diagram keeps undo history separate for each.
const cmDocs = new Map();
const getCmDoc = d => {
  if (!cmDocs.has(d.id)) cmDocs.set(d.id, CodeMirror.Doc(d.code, 'mermaid'));
  return cmDocs.get(d.id);
};
const cm = CodeMirror($('#editorHost'), {
  value: getCmDoc(cur()),
  theme: 'marsam', lineNumbers: true, lineWrapping: settings.wrap, tabSize: 4, indentUnit: 4,
  matchBrackets: true, autoCloseBrackets: '()[]{}""', styleActiveLine: true, direction: 'ltr',
  gutters: ['cm-err-gutter', 'CodeMirror-linenumbers'],
  extraKeys: {
    'Ctrl-Space': 'autocomplete', 'Cmd-Space': 'autocomplete',
    'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
    'Ctrl-D': duplicateLine, 'Cmd-D': duplicateLine,
    'Alt-Up': ed => moveLines(ed, -1), 'Alt-Down': ed => moveLines(ed, 1),
    'Tab': ed => ed.somethingSelected() ? ed.indentSelection('add') : ed.replaceSelection(' '.repeat(ed.getOption('indentUnit')), 'end'),
    'Shift-Tab': ed => ed.indentSelection('subtract'),
    'Ctrl-H': 'replace', 'Alt-G': 'jumpToLine',
  },
});
function applyEditorPrefs() {
  document.documentElement.style.setProperty('--code-size', settings.fontSize + 'px');
  cm.setOption('lineWrapping', settings.wrap);
  cm.refresh();
}

/* ================= Save state & document list ================= */
let saveTimer = null, storageOk = true, autosavePending = false;
function updateSaveState() {
  const d = cur(), el = $('#saveState');
  let state, text;
  if (!storageOk) { state = 'error'; text = t('saveError'); }
  else if (d?.path) { const dirty = isFileDirty(d); state = dirty ? 'file-dirty' : 'saved'; text = t(dirty ? 'unsavedFile' : 'savedFile'); }
  else { state = autosavePending ? 'dirty' : 'saved'; text = t(autosavePending ? 'saving' : 'saved'); }
  el.dataset.state = state;
  el.querySelector('.txt').textContent = text;
}
function persist() {
  clearTimeout(saveTimer);
  autosavePending = false;
  storageOk = store.set('docs', docs) && store.set('current', currentId);
  updateSaveState();
  return storageOk;
}
function scheduleSave() { autosavePending = true; updateSaveState(); clearTimeout(saveTimer); saveTimer = setTimeout(persist, 500); }

function setDocTitle() {
  const d = cur();
  document.title = t('docTitle', { name: (isFileDirty(d) ? '● ' : '') + (d?.name || t('untitled')) });
}
function updateFileUI() {
  const d = cur(), linked = !!d?.path;
  const chip = $('#fileChip');
  chip.hidden = !linked;
  if (linked) {
    $('#fileChipName').textContent = baseName(d.path);
    $('#fileChipDirty').hidden = !isFileDirty(d);
    chip.title = t('fileChipTitle', { path: d.path });
  }
  $('#fileRevealItem').hidden = !native || !linked;
  updateSaveState();
  setDocTitle();
}

let listTimer = null;
function renderDocList() {
  const q = $('#docSearch').value.trim().toLowerCase();
  const items = [...docs].sort((a, b) => b.updated - a.updated)
    .filter(d => !q || d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q) || (d.path || '').toLowerCase().includes(q));
  const ul = $('#docList');
  if (!items.length) { ul.innerHTML = `<li class="empty-note">${esc(t(q ? 'noResults' : 'noDocs'))}</li>`; return; }
  ul.innerHTML = items.map(d => {
    const tp = detectType(d.code);
    const file = d.path ? icon('file', 'ico fi') : '';
    const dirty = isFileDirty(d) ? '<i class="dd"></i>' : '';
    return `<li class="doc-item" data-id="${d.id}" aria-current="${d.id === currentId}">
      <button class="doc-open" title="${esc(d.path || d.name)}"><span class="n">${file}${esc(d.name)}${dirty}</span>
        <span class="m">${tp ? `<code>${esc(tp.kw)}</code> ·` : ''} ${esc(ago(d.updated))}</span></button>
      <div class="doc-actions">
        <button class="icon-btn" data-act="rename" title="${esc(t('rename'))}">${icon('pencil')}</button>
        <button class="icon-btn" data-act="dup" title="${esc(t('duplicate'))}">${icon('copy')}</button>
        <button class="icon-btn del" data-act="del" title="${esc(t('delete'))}">${icon('trash')}</button>
      </div></li>`;
  }).join('');
}
const scheduleList = () => { clearTimeout(listTimer); listTimer = setTimeout(renderDocList, 400); };

function openDoc(id) {
  const d = docs.find(x => x.id === id);
  if (!d) return;
  clearError();
  currentId = id;
  cm.swapDoc(getCmDoc(d));
  $('#docName').value = d.name;
  view.autoFit = true;
  hasGood = false;
  stage.innerHTML = '';
  updateMeta();
  updateFileUI();
  renderDocList();
  persist();
  render();
  if (isNarrow()) setSide(false);
  if (d.path) syncFromDisk(d);
}
function createDoc(name, code, open = true) {
  const now = Date.now();
  const d = { id: uid(), name, code, created: now, updated: now };
  docs.push(d);
  if (open) openDoc(d.id); else { persist(); renderDocList(); }
  return d;
}
function uniqueName(base) {
  const names = new Set(docs.map(d => d.name));
  if (!names.has(base)) return base;
  let i = 2;
  while (names.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}
function deleteDoc(id) {
  const idx = docs.findIndex(d => d.id === id);
  if (idx < 0) return;
  const [removed] = docs.splice(idx, 1);
  const wasCurrent = id === currentId;
  if (!docs.length) createDoc(t('untitled'), t('fallbackCode'), false);
  if (wasCurrent) openDoc(docs.slice().sort((a, b) => b.updated - a.updated)[0].id);
  else { persist(); renderDocList(); }
  toast(t('deleted', { name: removed.name }), { action: { label: t('undo'), fn: () => { docs.push(removed); persist(); openDoc(removed.id); } } });
}
function startRename(li) {
  const d = docs.find(x => x.id === li.dataset.id);
  const input = document.createElement('input');
  input.className = 'rename-input';
  input.value = d.name;
  input.dir = 'auto';
  li.replaceChildren(input);
  input.focus(); input.select();
  let done = false;
  const commit = ok => {
    if (done) return; done = true;
    if (ok && input.value.trim()) { d.name = input.value.trim(); d.updated = Date.now(); if (d.id === currentId) { $('#docName').value = d.name; setDocTitle(); } persist(); }
    renderDocList();
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') commit(true); if (e.key === 'Escape') commit(false); });
  input.addEventListener('blur', () => commit(true));
}
function newDoc() { createDoc(uniqueName(t('newDocName')), t('newDocCode')); cm.focus(); }
$('#docList').addEventListener('click', e => {
  const li = e.target.closest('.doc-item');
  if (!li) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  const d = docs.find(x => x.id === li.dataset.id);
  if (act === 'rename') return startRename(li);
  if (act === 'dup') { createDoc(uniqueName(d.name + t('copySuffix')), d.code); toast(t('dupCreated')); return; }
  if (act === 'del') return deleteDoc(d.id);
  if (e.target.closest('.doc-open') && d.id !== currentId) openDoc(d.id);
});
$('#docList').addEventListener('dblclick', e => { const li = e.target.closest('.doc-item'); if (li && e.target.closest('.doc-open')) startRename(li); });
$('#docSearch').addEventListener('input', renderDocList);
$('#btnNewDoc').onclick = newDoc;
$('#docName').addEventListener('input', e => { const d = cur(); d.name = e.target.value; d.updated = Date.now(); scheduleSave(); scheduleList(); setDocTitle(); });
$('#docName').addEventListener('change', e => { if (!e.target.value.trim()) { e.target.value = cur().name = t('untitled'); persist(); renderDocList(); setDocTitle(); } });
$('#docName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.target.blur(); cm.focus(); } });

/* ================= Files on disk (desktop app) ================= */
// A diagram opened from — or saved to — a .mmd file stays linked to it: Ctrl+S writes back
// to that file. Every diagram is also autosaved inside the app, so nothing is lost either way.
function setDocCode(d, code) {
  d.code = code;
  const doc = cmDocs.get(d.id);
  if (doc && doc.getValue() !== code) doc.setValue(code);
}
async function saveDocToFile(d, { silent = false } = {}) {
  try {
    await native.writeFile(d.path, d.code + '\n');
    d.fileCode = d.code;
    persist(); updateFileUI(); renderDocList();
    if (!silent) toast(t('savedTo', { name: baseName(d.path) }));
    return true;
  } catch (e) {
    toast(t('saveFailed', { msg: e?.message || e }), { kind: 'error', ms: 5000 });
    return false;
  }
}
async function saveAsFile(d) {
  let r;
  try { r = await native.saveFile(safeName(d.path ? stripExt(baseName(d.path)) : d.name) + '.mmd', d.code + '\n', t('filterMermaid')); }
  catch (e) { toast(t('saveFailed', { msg: e?.message || e }), { kind: 'error', ms: 5000 }); return false; }
  if (r?.status !== 'saved') return false;
  if (TEXT_FILE_RE.test(r.path)) {
    d.path = r.path;
    d.fileCode = d.code;
    d.name = stripExt(baseName(r.path));
    if (d.id === currentId) $('#docName').value = d.name;
  }
  persist(); updateFileUI(); renderDocList();
  toast(t('savedTo', { name: baseName(r.path) }), { action: { label: t('showInFolder'), fn: () => native.showInFolder(r.path) } });
  return true;
}
async function saveCurrent(saveAs = false) {
  const d = cur();
  persist();
  if (!native) {
    if (saveAs) return doExport('mmd');
    return toast(storageOk ? t('savedLocal') : t('storageUnavailable'), storageOk ? {} : { kind: 'error' });
  }
  if (d.path && !saveAs) return saveDocToFile(d);
  return saveAsFile(d);
}
async function openFileDialog() {
  if (!native) return $('#fileInput').click();
  try {
    const files = await native.openFiles(t('filterOpen'));
    if (files?.length) importTexts(files);
  } catch (e) { toast(String(e?.message || e), { kind: 'error', ms: 5000 }); }
}
// Picks up edits made to a linked file by other programs.
async function syncFromDisk(d) {
  if (!native || !d?.path) return;
  let r;
  try { r = await native.readFile(d.path); } catch { return; }
  if (!r || !d.path) return;
  const name = baseName(d.path);
  if (r.missing) {
    toast(t('fileMissing', { name }), { kind: 'error', ms: 6000 });
    d.path = null; delete d.fileCode;
    persist(); updateFileUI(); renderDocList();
    return;
  }
  const disk = norm(r.text);
  if (disk === d.fileCode) return;
  const reload = () => { d.fileCode = disk; setDocCode(d, disk); persist(); updateFileUI(); renderDocList(); };
  if (!isFileDirty(d)) { reload(); toast(t('reloadedFromDisk', { name })); }
  else toast(t('diskChanged', { name }), { ms: 8000, action: { label: t('loadDisk'), fn: reload } });
}
async function confirmUnsaved() {
  const dirty = docs.filter(isFileDirty);
  if (!native || !dirty.length) return true;
  const choice = await native.askUnsaved({
    message: t('unsavedTitle'),
    detail: t('unsavedDetail', { files: dirty.map(d => '• ' + baseName(d.path)).join('\n') }),
    buttons: [t('btnSave'), t('btnDontSave'), t('btnCancel')],
  });
  if (choice === 0) {
    for (const d of dirty) if (!(await saveDocToFile(d, { silent: true }))) return false;
    return true;
  }
  return choice === 1;
}
$('#fileChip').onclick = () => { const d = cur(); if (native && d.path) native.showInFolder(d.path); };

/* ================= Import (files, drag & drop, backups) ================= */
// Opening the same file twice (e.g. double-clicking it again) reuses the existing diagram.
function addImported(name, code, filePath) {
  if (filePath) {
    const same = docs.find(d => d.path && samePath(d.path, filePath));
    if (same) {
      if (!isFileDirty(same) && same.code !== code) { same.fileCode = code; setDocCode(same, code); }
      same.fileCode = code;
      return same;
    }
    const d = createDoc(uniqueName(name), code, false);
    d.path = filePath;
    d.fileCode = code;
    return d;
  }
  return docs.find(d => !d.path && d.code === code) || createDoc(uniqueName(name), code, false);
}
function importTexts(items) {
  let last = null, count = 0;
  for (const item of items) {
    const name = String(item.name || ''), text = norm(item.text);
    const base = stripExt(name) || t('importedName');
    if (/\.json$/i.test(name)) {
      let data = null;
      try { data = JSON.parse(text); } catch {}
      const list = data?.app === 'marsam' && Array.isArray(data.docs) ? data.docs.filter(d => typeof d?.code === 'string') : null;
      if (!list) { toast(t('notBackup', { name }), { kind: 'error' }); continue; }
      list.forEach(d => { last = addImported(String(d.name || base), norm(d.code)); count++; });
    } else if (/\.(md|markdown)$/i.test(name)) {
      const blocks = [...text.matchAll(/```mermaid[^\n]*\n([\s\S]*?)```/g)].map(m => norm(m[1]));
      if (!blocks.length) { toast(t('noBlocks', { name }), { kind: 'error' }); continue; }
      blocks.forEach((b, i) => { last = addImported(blocks.length > 1 ? `${base} (${i + 1})` : base, b); count++; });
    } else {
      const linkable = item.path && TEXT_FILE_RE.test(item.path) ? item.path : null;
      last = addImported(base, text, linkable);
      count++;
    }
  }
  if (last) {
    openDoc(last.id);
    toast(count > 1 ? t('openedMany', { n: count }) : t('openedOne', { name: last.name }));
  }
}
async function importFiles(files) {
  importTexts(await Promise.all(files.map(async f => ({ name: f.name, text: await f.text() }))));
}
function backupAll() {
  const payload = { app: 'marsam', format: 1, exported: new Date().toISOString(),
    docs: docs.map(({ name, code, created, updated }) => ({ name, code, created, updated })) };
  saveFile(`marsam-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
}
$('#btnOpenFile').onclick = openFileDialog;
$('#btnBackup').onclick = backupAll;
$('#fileInput').addEventListener('change', e => { importFiles([...e.target.files]); e.target.value = ''; });
let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $('#dropOverlay').hidden = false; });
window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; if (--dragDepth <= 0) { dragDepth = 0; $('#dropOverlay').hidden = true; } });
window.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault(); dragDepth = 0; $('#dropOverlay').hidden = true;
  importFiles([...e.dataTransfer.files]);
});

/* ================= Meta & status ================= */
function updateMeta() {
  const code = cm.getValue();
  const tp = detectType(code);
  const chip = $('#typeChip');
  if (!tp) { chip.textContent = t('typeEmpty'); delete chip.dataset.unknown; }
  else if (tp.label) { chip.innerHTML = `<code>${esc(tp.kw)}</code><span class="hide-sm">${esc(tp.label)}</span>`; delete chip.dataset.unknown; }
  else { chip.innerHTML = `<code>${esc(tp.kw.slice(0, 24))}</code>${esc(t('typeUnknown'))}`; chip.dataset.unknown = ''; }
  $('#stSize').textContent = t('sizeInfo', { lines: cm.lineCount(), chars: code.length });
  if (settings.panel === 'snippets' && app.dataset.side === 'open') renderSnippets();
}
function updateCursor() {
  const c = cm.getCursor(), sel = cm.getSelection().length;
  $('#stCursor').textContent = t('cursorPos', { line: c.line + 1, col: c.ch + 1 }) + (sel ? t('cursorSel', { n: sel }) : '');
}
cm.on('changes', () => {
  const d = cur();
  d.code = cm.getValue();
  d.updated = Date.now();
  scheduleSave();
  scheduleList();
  updateMeta();
  if (d.path) updateFileUI();
  if (settings.autoRender) scheduleRender();
});
cm.on('cursorActivity', updateCursor);

/* ================= UI theme ================= */
const isUiDark = () => getComputedStyle(document.documentElement).getPropertyValue('--is-dark').trim() === '1';
let lastDark = null;
function applyUiThemeButton() {
  const ic = { system: 'monitor', light: 'sun', dark: 'moon' }[settings.uiTheme];
  const label = t({ system: 'uiThemeSystem', light: 'uiThemeLight', dark: 'uiThemeDark' }[settings.uiTheme]);
  const b = $('#btnUiTheme');
  b.innerHTML = icon(ic, 'ico');
  b.title = label; b.setAttribute('aria-label', label);
}
function applyUiTheme() {
  if (settings.uiTheme === 'system') delete document.documentElement.dataset.ui;
  else document.documentElement.dataset.ui = settings.uiTheme;
  applyUiThemeButton();
  syncSegs();
  onUiMaybeChanged();
}
function onUiMaybeChanged() {
  const dark = isUiDark();
  if (dark === lastDark) return;
  lastDark = dark;
  if (settings.theme === 'auto') { updateTone(); if (mermaidApi) render(); thumbsKey = null; if (settings.panel === 'templates') ensureThumbs(); }
}
$('#btnUiTheme').onclick = () => {
  settings.uiTheme = { system: 'light', light: 'dark', dark: 'system' }[settings.uiTheme];
  saveSettings(); applyUiTheme();
  toast($('#btnUiTheme').title);
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onUiMaybeChanged);
new MutationObserver(onUiMaybeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ================= Mermaid config & render ================= */
let mermaidApi = null, renderSeq = 0, renderTimer = null, hasGood = false, dims = { w: 0, h: 0 };
const effectiveTheme = () => settings.theme === 'auto' ? (isUiDark() ? 'dark' : 'default') : settings.theme;
function mermaidConfig() {
  const font = FONTS[settings.font] || FONTS.ibm;
  const theme = effectiveTheme();
  const cfg = {
    startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true,
    theme, look: settings.look, fontFamily: font.css, htmlLabels: settings.htmlLabels,
    flowchart: { curve: settings.curve },
    themeVariables: theme === 'base' ? { ...settings.baseVars, fontFamily: font.css } : { fontFamily: font.css },
  };
  if (settings.layout !== 'auto') cfg.layout = settings.layout;
  return cfg;
}
function codeTheme(code) {
  const m = code.match(/theme["']?\s*:\s*["']?([\w-]+)/) || code.match(/%%\{\s*init[^}]*["']theme["']\s*:\s*["']([\w-]+)/);
  return m ? m[1] : null;
}
function updateTone(code = cm.getValue()) {
  const th = codeTheme(code) || effectiveTheme();
  canvas.dataset.tone = /dark/.test(th) ? 'dark' : 'light';
}
function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(render, settings.delay); }
function setCanvasMsg(html) { const m = $('#canvasMsg'); m.hidden = !html; if (html) m.innerHTML = html; }

async function render() {
  clearTimeout(renderTimer);
  if (!mermaidApi) return;
  const code = cm.getValue();
  const seq = ++renderSeq, id = 'marsam-' + seq;
  updateTone(code);
  if (!code.trim()) {
    stage.innerHTML = ''; hasGood = false; clearError(); $('#diagMeta').textContent = '';
    setCanvasMsg(`<strong>${esc(t('emptyTitle'))}</strong><span>${esc(t('emptyText'))}</span><button class="btn sm" data-open-panel="templates">${icon('grid')}${esc(t('browseTemplates'))}</button>`);
    $('#stRender').innerHTML = '';
    return;
  }
  const t0 = performance.now();
  try {
    mermaidApi.initialize(mermaidConfig());
    const { svg, bindFunctions } = await mermaidApi.render(id, code);
    if (seq !== renderSeq) return;
    stage.innerHTML = svg;
    bindFunctions?.(stage);
    stage.classList.remove('stale');
    hasGood = true;
    setCanvasMsg(null);
    measureSvg();
    clearError();
    $('#stRender').innerHTML = `<span class="ok">●</span> ${esc(t('renderedIn'))} <bdi>${Math.round(performance.now() - t0)} ms</bdi>`;
    if (view.autoFit) fit(true); else applyView();
  } catch (err) {
    document.getElementById('d' + id)?.remove();
    document.getElementById(id)?.remove();
    if (seq !== renderSeq) return;
    showError(err, code);
  }
}
function measureSvg() {
  const el = stage.querySelector('svg');
  if (!el) return;
  const vb = el.viewBox?.baseVal;
  let w, h;
  if (vb && vb.width && vb.height) { w = vb.width; h = vb.height; }
  else { const b = el.getBBox(); w = b.width; h = b.height; }
  el.setAttribute('width', w);
  el.setAttribute('height', h);
  el.style.maxWidth = 'none';
  dims = { w, h };
  const nodes = el.querySelectorAll('g.node').length;
  $('#diagMeta').textContent = `${Math.round(w)} × ${Math.round(h)} px` + (nodes ? ` · ${nodes} nodes` : '');
}

/* ================= Errors ================= */
let errLine = null;
// Mermaid strips front matter and %%{ }%% directive lines before parsing, so its line
// numbers refer to the stripped text. Map them back to the editor's lines.
function parsedLineMap(code) {
  const lines = code.split('\n'), keep = [];
  const fm = code.match(/^\s*---\r?\n[\s\S]*?\r?\n---[ \t]*(?=\r?\n|$)/);
  let inDir = false;
  for (let i = fm ? fm[0].split('\n').length : 0; i < lines.length; i++) {
    const l = lines[i];
    if (inDir) { if (l.includes('}%%')) inDir = false; continue; }
    if (/^\s*%%\{/.test(l)) { if (!l.includes('}%%')) inDir = true; continue; }
    keep.push(i + 1);
  }
  return keep;
}
function errorLine(err, code) {
  let n = err?.hash?.loc?.first_line ?? null;
  if (n == null) { const m = String(err?.message || err).match(/line[:\s]+(\d+)/i); n = m ? +m[1] : null; }
  if (n == null) return null;
  return clamp(parsedLineMap(code)[n - 1] ?? n, 1, cm.lineCount());
}
function showError(err, code) {
  const msg = String(err?.message || err || t('unknownError')).trim();
  const unknown = /No diagram type detected|UnknownDiagramError/i.test(msg) || err?.name === 'UnknownDiagramError';
  const line = unknown ? null : errorLine(err, code);
  $('#errorTitle').textContent = unknown ? t('errUnknownType') : line ? t('errAtLine', { line }) : t('errRender');
  $('#errorMsg').textContent = msg;
  const g = $('#errorGoto');
  g.hidden = !line;
  if (line) { g.textContent = t('gotoLine', { line }); g.dataset.line = line; }
  $('#errorBar').hidden = false;
  stage.classList.toggle('stale', hasGood);
  $('#staleBadge').hidden = !hasGood;
  if (!hasGood) setCanvasMsg(`<strong>${esc(t('cantRenderTitle'))}</strong><span>${esc(t('cantRenderText'))}</span>`);
  $('#stRender').innerHTML = `<span class="bad">●</span> ${line ? `${esc(t('statusErrorLine'))} <bdi>${line}</bdi>` : esc(t('statusError'))}`;
  markErrorLine(line);
}
function markErrorLine(line) {
  if (errLine != null) {
    cm.removeLineClass(errLine, 'background', 'cm-err-line');
    cm.clearGutter('cm-err-gutter');
    errLine = null;
  }
  if (line) {
    const h = cm.addLineClass(line - 1, 'background', 'cm-err-line');
    const m = document.createElement('div');
    m.className = 'err-marker'; m.textContent = '!'; m.title = t('errMarker');
    cm.setGutterMarker(line - 1, 'cm-err-gutter', m);
    errLine = h;
  }
}
function clearError() {
  $('#errorBar').hidden = true;
  $('#staleBadge').hidden = true;
  stage.classList.remove('stale');
  markErrorLine(null);
}
$('#errorGoto').onclick = e => goToLine(+e.currentTarget.dataset.line);
$('#errorClose').onclick = () => { $('#errorBar').hidden = true; };
function goToLine(n, from = 0, to = null) {
  const l = n - 1;
  cm.focus();
  if (to != null) cm.setSelection(CodeMirror.Pos(l, from), CodeMirror.Pos(l, to));
  else cm.setCursor(CodeMirror.Pos(l, cm.getLine(l).length));
  cm.scrollIntoView(null, 120);
  const h = cm.addLineClass(l, 'background', 'cm-flash-line');
  setTimeout(() => cm.removeLineClass(h, 'background', 'cm-flash-line'), 1300);
}

/* ================= Pan & zoom ================= */
const view = { x: 0, y: 0, k: 1, autoFit: true };
function applyView() {
  stage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
  $('#zoomVal').textContent = Math.round(view.k * 100) + '%';
  let size = 20 * view.k;
  while (size < 12) size *= 2;
  while (size > 48) size /= 2;
  canvas.style.backgroundSize = `${size}px ${size}px`;
  canvas.style.backgroundPosition = `${view.x}px ${view.y}px`;
}
function fit(auto = false) {
  if (!dims.w) return;
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const pad = r.width < 500 ? 20 : 40;
  const k = clamp(Math.min((r.width - pad * 2) / dims.w, (r.height - pad * 2) / dims.h), 0.05, 1.6);
  view.k = k;
  view.x = (r.width - dims.w * k) / 2;
  view.y = (r.height - dims.h * k) / 2;
  view.autoFit = true;
  applyView();
  if (!auto) canvas.focus({ preventScroll: true });
}
function zoomTo(k, cx, cy) {
  if (cx == null) { const r = canvas.getBoundingClientRect(); cx = r.width / 2; cy = r.height / 2; }
  k = clamp(k, 0.05, 8);
  const f = k / view.k;
  view.x = cx - (cx - view.x) * f;
  view.y = cy - (cy - view.y) * f;
  view.k = k;
  view.autoFit = false;
  applyView();
}
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  if (e.ctrlKey || e.metaKey || !e.shiftKey) {
    const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
    zoomTo(view.k * f, e.clientX - r.left, e.clientY - r.top);
  } else { view.x -= e.deltaY; view.autoFit = false; applyView(); }
}, { passive: false });
const pointers = new Map();
let pinch = null, downAt = null;
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.target.closest('button, a')) return;
  window.getSelection()?.removeAllRanges();
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  downAt = { x: e.clientX, y: e.clientY, target: e.target };
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k }; }
  canvas.classList.add('grabbing');
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1) { view.x += dx; view.y += dy; view.autoFit = false; applyView(); }
  else if (pointers.size === 2 && pinch) {
    const [a, b] = [...pointers.values()], r = canvas.getBoundingClientRect();
    zoomTo(pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
  }
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!pointers.size) {
    canvas.classList.remove('grabbing');
    if (downAt && e.type === 'pointerup' && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 4) locateInCode(downAt.target);
    downAt = null;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('dblclick', e => { if (!e.target.closest('button')) fit(); });
canvas.addEventListener('keydown', e => {
  const step = 60;
  const map = {
    '+': () => zoomTo(view.k * 1.2), '=': () => zoomTo(view.k * 1.2), '-': () => zoomTo(view.k / 1.2),
    '0': () => fit(), '1': () => zoomTo(1), 'f': toggleFull, 'F': toggleFull,
    ArrowLeft: () => { view.x += step; }, ArrowRight: () => { view.x -= step; },
    ArrowUp: () => { view.y += step; }, ArrowDown: () => { view.y -= step; },
  };
  if (!map[e.key]) return;
  e.preventDefault();
  map[e.key]();
  if (e.key.startsWith('Arrow')) { view.autoFit = false; applyView(); }
});
$('#zoomIn').onclick = () => zoomTo(view.k * 1.2);
$('#zoomOut').onclick = () => zoomTo(view.k / 1.2);
$('#zoomVal').onclick = () => zoomTo(1);
$('#zoomFit').onclick = () => fit();
function toggleFull() {
  const p = $('#panePreview');
  if (document.fullscreenElement) document.exitFullscreen?.();
  else p.requestFullscreen?.().catch(() => toast(t('fullscreenNA'), { kind: 'error' }));
}
$('#btnFull').onclick = toggleFull;
new ResizeObserver(() => { if (view.autoFit) fit(true); }).observe(canvas);
new ResizeObserver(() => requestAnimationFrame(() => cm.refresh())).observe($('#editorHost'));

// Click a node in the preview to jump to its line in the code.
function locateInCode(target) {
  const node = target.closest?.('g.node, g.actor, .actor, g.cluster, g[id*="entity-"], g[id*="classId-"], g[id*="state-"]');
  if (!node || !stage.contains(node)) return;
  const lines = cm.getValue().split('\n');
  const candidates = [];
  const rawId = node.id || node.getAttribute('data-id') || '';
  if (rawId) {
    const m = rawId.replace(/^marsam-\d+-/, '').replace(/^(flowchart|classId|state|entity|mindmap|kanban|block)-/, '').replace(/-\d+$/, '');
    if (m && m.length < 60) candidates.push(m);
  }
  const label = (node.textContent || '').replace(/\s+/g, ' ').trim();
  if (label) candidates.push(label, label.split(' ').slice(0, 3).join(' '));
  for (const c of candidates) {
    const re = new RegExp('(^|[^\\w\\u0600-\\u06FF])(' + reEsc(c) + ')(?![\\w\\u0600-\\u06FF])');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(re);
      if (m) { const from = m.index + m[1].length; goToLine(i + 1, from, from + c.length); return; }
    }
  }
}

/* ================= Layout, splitter, side panel ================= */
function applyLayout() {
  work.dataset.layout = settings.viewLayout;
  work.style.setProperty('--split', settings.split);
  $$('.seg-layout [data-layout]').forEach(b => b.setAttribute('aria-pressed', b.dataset.layout === settings.viewLayout));
  requestAnimationFrame(() => { cm.refresh(); if (view.autoFit) fit(true); });
}
$$('.seg-layout [data-layout]').forEach(b => b.onclick = () => { settings.viewLayout = b.dataset.layout; saveSettings(); applyLayout(); });
const stacked = () => isNarrow() || settings.viewLayout === 'split-v';
const splitter = $('#splitter');
splitter.addEventListener('pointerdown', e => {
  splitter.setPointerCapture(e.pointerId);
  splitter.classList.add('dragging'); work.classList.add('resizing');
});
splitter.addEventListener('pointermove', e => {
  if (!splitter.hasPointerCapture(e.pointerId)) return;
  const r = work.getBoundingClientRect();
  // The editor is the first grid column: on the right in Arabic, on the left in English.
  const ratio = stacked() ? (e.clientY - r.top) / r.height
    : (app.dir === 'rtl' ? r.right - e.clientX : e.clientX - r.left) / r.width;
  settings.split = clamp(ratio, 0.16, 0.84);
  work.style.setProperty('--split', settings.split);
});
const endSplit = e => {
  if (!splitter.hasPointerCapture?.(e.pointerId) && !splitter.classList.contains('dragging')) return;
  splitter.classList.remove('dragging'); work.classList.remove('resizing'); saveSettings(); cm.refresh();
};
splitter.addEventListener('pointerup', endSplit);
splitter.addEventListener('lostpointercapture', endSplit);
splitter.addEventListener('keydown', e => {
  const towardEditorEnd = app.dir === 'rtl' ? 1 : -1;
  const d = { ArrowLeft: 0.03 * towardEditorEnd, ArrowRight: -0.03 * towardEditorEnd, ArrowUp: -0.03, ArrowDown: 0.03 }[e.key];
  if (d == null) return;
  e.preventDefault();
  settings.split = clamp(settings.split + d, 0.16, 0.84);
  saveSettings(); applyLayout();
});
splitter.addEventListener('dblclick', () => { settings.split = DEFAULTS.split; saveSettings(); applyLayout(); });

function setSide(open) {
  app.dataset.side = open ? 'open' : 'closed';
  if (!isNarrow()) { settings.sideOpen = open; saveSettings(); }
  $('#scrim').hidden = !(open && isNarrow());
  $('#scrim').classList.add('light');
  $$('.rail-btn').forEach(b => b.setAttribute('aria-pressed', open && b.dataset.panel === settings.panel));
  setTimeout(() => { cm.refresh(); if (view.autoFit) fit(true); }, 200);
}
function setPanel(name, toggle = false) {
  if (toggle && settings.panel === name && app.dataset.side === 'open') return setSide(false);
  settings.panel = name;
  saveSettings();
  $$('.panel').forEach(p => p.hidden = p.dataset.panel !== name);
  setSide(true);
  if (name === 'templates') ensureThumbs();
  if (name === 'snippets') renderSnippets();
  if (name === 'docs') renderDocList();
}
$$('.rail-btn').forEach(b => b.onclick = () => setPanel(b.dataset.panel, true));
matchMedia('(max-width: 820px)').addEventListener('change', e => { setSide(e.matches ? false : settings.sideOpen); applyLayout(); });
$('#scrim').onclick = () => { closeModal(); if (isNarrow()) setSide(false); };
document.addEventListener('click', e => { const el = e.target.closest('[data-open-panel]'); if (el) setPanel(el.dataset.openPanel); });

/* ================= Templates panel ================= */
function renderTemplates() {
  const q = $('#tplSearch').value.trim().toLowerCase();
  const groups = {};
  MARSAM_TEMPLATES.filter(tp => !q || [tp.name.ar, tp.name.en, tp.kw, tp.key].some(s => s.toLowerCase().includes(q)))
    .forEach(tp => (groups[tp.group] ||= []).push(tp));
  const html = Object.entries(groups).map(([g, list]) => `<div class="tpl-group"><h3>${esc(t(g))}</h3><div class="tpl-grid">${list.map(tp =>
    `<button class="tpl-card" data-key="${tp.key}" title="${esc(t('tplOpenTitle', { name: L(tp.name) }))}"><span class="tpl-thumb loading" data-key="${tp.key}"></span><span class="t">${esc(L(tp.name))}</span><span class="k">${esc(tp.kw)}</span></button>`).join('')}</div></div>`).join('');
  $('#tplList').innerHTML = html || `<p class="empty-note">${esc(t('noTplMatch'))}</p>`;
  thumbsKey = null;
  ensureThumbs();
}
let thumbsKey = null, thumbBusy = false, thumbSeq = 0;
const thumbQueue = [];
function ensureThumbs() {
  if (settings.panel !== 'templates' || !mermaidApi) return;
  const key = [LANG, effectiveTheme(), settings.look, settings.font, settings.layout, settings.curve, JSON.stringify(settings.baseVars)].join('|');
  if (thumbsKey === key) return;
  thumbsKey = key;
  thumbQueue.length = 0;
  const tone = /dark/.test(effectiveTheme()) ? 'dark' : 'light';
  $$('.tpl-thumb').forEach(el => { el.innerHTML = ''; el.className = 'tpl-thumb loading'; el.dataset.tone = tone; thumbQueue.push(el); });
  pumpThumbs();
}
async function pumpThumbs() {
  if (thumbBusy) return;
  thumbBusy = true;
  while (thumbQueue.length) {
    const el = thumbQueue.shift();
    if (!el.isConnected) continue;
    const id = 'thumb-' + (++thumbSeq);
    const tp = TPL[el.dataset.key];
    try {
      mermaidApi.initialize(mermaidConfig());
      const { svg } = await mermaidApi.render(id, L(tp.code));
      el.innerHTML = svg;
      const s = el.querySelector('svg');
      s.removeAttribute('style');
      s.setAttribute('width', '100%'); s.setAttribute('height', '100%');
      s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    } catch {
      document.getElementById('d' + id)?.remove();
      el.textContent = tp.kw;
    }
    el.classList.remove('loading');
    await new Promise(r => setTimeout(r, 10));
  }
  thumbBusy = false;
}
$('#tplList').addEventListener('click', e => {
  const card = e.target.closest('.tpl-card');
  if (!card) return;
  const tp = TPL[card.dataset.key];
  createDoc(uniqueName(L(tp.name)), L(tp.code));
  toast(t('tplOpened', { name: L(tp.name) }));
});
$('#tplSearch').addEventListener('input', renderTemplates);

/* ================= Snippets panel ================= */
function renderSnippets() {
  const tp = detectType(cm.getValue());
  const key = tp?.snip;
  $('#snipBanner').innerHTML = tp
    ? `${esc(t('snipCurrent'))} <code>${esc(tp.kw)}</code>${tp.label ? ' — ' + esc(tp.label) : ''}`
    : esc(t('snipStart'));
  const groups = [];
  if (key && MARSAM_SNIPPETS[key]) groups.push([t('snipFor', { label: tp.label }), MARSAM_SNIPPETS[key], key]);
  groups.push([t('snipCommon'), MARSAM_SNIPPETS.common, 'common']);
  $('#snipList').innerHTML = groups.map(([title, list, k]) => `<div class="snip-group"><h3>${esc(title)}</h3>${list.map((s, i) =>
    `<button class="snip" data-g="${k}" data-i="${i}"><span class="t">${esc(L(s.l))}</span><code>${esc(L(s.c))}</code></button>`).join('')}</div>`).join('');
}
$('#snipList').addEventListener('click', e => {
  const b = e.target.closest('.snip');
  if (!b) return;
  const s = MARSAM_SNIPPETS[b.dataset.g][+b.dataset.i];
  insertSnippet(L(s.c), s.top);
});
function insertSnippet(text, atTop) {
  if (atTop) {
    if (/^\s*---\r?\n/.test(cm.getValue())) { toast(t('frontExists'), { kind: 'error' }); return; }
    cm.replaceRange(text + '\n', CodeMirror.Pos(0, 0));
    cm.focus();
    return;
  }
  const c = cm.getCursor(), line = cm.getLine(c.line);
  let ind = line.match(/^\s*/)[0];
  if (MARSAM_HEAD_RE.test(line.trim())) ind += '    ';
  const body = text.split('\n').map(l => ind + l).join('\n');
  const n = text.split('\n').length;
  cm.operation(() => {
    if (!line.trim()) cm.replaceRange(body, CodeMirror.Pos(c.line, 0), CodeMirror.Pos(c.line, line.length));
    else cm.replaceRange('\n' + body, CodeMirror.Pos(c.line, line.length));
    const l = line.trim() ? c.line + n : c.line + n - 1;
    cm.setCursor(CodeMirror.Pos(l, cm.getLine(l).length));
  });
  cm.focus();
}

/* ================= Settings panel ================= */
function syncSegs() {
  $$('[data-seg]').forEach(g => $$('button', g).forEach(b => b.setAttribute('aria-pressed', String(settings[g.dataset.seg]) === b.dataset.value)));
}
function syncSettingsUI() {
  $$('[data-setting]').forEach(el => {
    const v = settings[el.dataset.setting];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  });
  syncSegs();
  $('#outFontSize').textContent = settings.fontSize + 'px';
  $('#outDelay').textContent = settings.delay + ' ms';
  $('#baseColors').hidden = settings.theme !== 'base';
  $('#autoRender').checked = settings.autoRender;
  $('#pngHint').textContent = settings.pngScale + '×';
  canvas.dataset.bg = settings.bg;
  $('#colorGrid').innerHTML = BASE_VARS.map(([k, label]) =>
    `<label class="color-field"><input type="color" data-var="${k}" value="${settings.baseVars[k]}">${esc(t(label))}</label>`).join('');
}
const DIAGRAM_KEYS = new Set(['theme', 'look', 'layout', 'curve', 'font', 'htmlLabels']);
function onSettingChanged(key) {
  saveSettings();
  if (key === 'lang') return setLanguage(settings.lang);
  if (key === 'uiTheme') return applyUiTheme();
  if (DIAGRAM_KEYS.has(key)) {
    const f = FONTS[settings.font];
    const ready = f.family ? document.fonts.load(`16px "${f.family}"`, 'عربي Aa').catch(() => {}) : Promise.resolve();
    ready.then(() => { view.autoFit = view.autoFit || key === 'layout'; render(); thumbsKey = null; ensureThumbs(); });
  }
  if (key === 'theme') { $('#baseColors').hidden = settings.theme !== 'base'; updateTone(); }
  if (key === 'fontSize' || key === 'wrap') applyEditorPrefs();
  if (key === 'bg') canvas.dataset.bg = settings.bg;
  if (key === 'autoRender' && settings.autoRender) render();
  $('#outFontSize').textContent = settings.fontSize + 'px';
  $('#outDelay').textContent = settings.delay + ' ms';
  $('#pngHint').textContent = settings.pngScale + '×';
}
document.addEventListener('change', e => {
  const el = e.target.closest('[data-setting]');
  if (!el) return;
  const k = el.dataset.setting;
  settings[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
  onSettingChanged(k);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.type === 'range' && el.dataset.setting) { settings[el.dataset.setting] = +el.value; onSettingChanged(el.dataset.setting); }
  if (el.dataset.var) {
    settings.baseVars[el.dataset.var] = el.value;
    saveSettings();
    clearTimeout(el._t); el._t = setTimeout(() => { render(); thumbsKey = null; }, 120);
  }
});
$$('[data-seg]').forEach(g => g.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const k = g.dataset.seg;
  settings[k] = /^\d+$/.test(b.dataset.value) ? +b.dataset.value : b.dataset.value;
  $$('button', g).forEach(x => x.setAttribute('aria-pressed', x === b));
  onSettingChanged(k);
}));
$('#autoRender').addEventListener('change', e => { settings.autoRender = e.target.checked; onSettingChanged('autoRender'); });
$('#resetColors').onclick = () => { settings.baseVars = { ...DEFAULTS.baseVars }; saveSettings(); syncSettingsUI(); render(); };
$('#resetSettings').onclick = () => {
  const keep = { lang: settings.lang, uiTheme: settings.uiTheme, autoUpdate: settings.autoUpdate,
    viewLayout: settings.viewLayout, split: settings.split, sideOpen: settings.sideOpen, panel: settings.panel };
  Object.assign(settings, structuredClone(DEFAULTS), keep);
  saveSettings(); syncSettingsUI(); applyEditorPrefs(); render(); thumbsKey = null;
  toast(t('settingsReset'));
};
$('#btnRender').onclick = () => { render(); cm.focus(); };

/* ================= Export ================= */
// PNG and PDF rasterise the SVG outside this page, where the page's fonts are not
// available, so the chosen font's @font-face rules (data URIs from vendor/fonts.js) go inside it.
async function fontFaceCss() {
  const f = FONTS[settings.font];
  return (f?.family && window.MARSAM_FONT_CSS?.[f.family]) || '';
}
function svgString({ fontCss = '', bg = null, prolog = true } = {}) {
  const el = stage.querySelector('svg');
  if (!el) return null;
  const clone = el.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', dims.w);
  clone.setAttribute('height', dims.h);
  clone.style.maxWidth = '';
  if (bg) clone.style.backgroundColor = bg;
  if (fontCss) {
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    st.textContent = fontCss;
    clone.insertBefore(st, clone.firstChild);
  }
  const xml = new XMLSerializer().serializeToString(clone);
  return prolog ? '<?xml version="1.0" encoding="UTF-8"?>\n' + xml : xml;
}
const previewBg = () => canvas.dataset.tone === 'dark' ? '#14171E' : '#FFFFFF';
const exportBg = () => settings.pngBg === 'transparent' ? null : settings.pngBg === 'white' ? '#FFFFFF' : previewBg();
async function pngBlob() {
  const str = svgString({ fontCss: await fontFaceCss() });
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + b64(new TextEncoder().encode(str));
  await img.decode();
  const maxSide = 16000;
  const scale = Math.min(settings.pngScale, maxSide / dims.w, maxSide / dims.h);
  const c = document.createElement('canvas');
  c.width = Math.ceil(dims.w * scale); c.height = Math.ceil(dims.h * scale);
  const ctx = c.getContext('2d');
  const bg = exportBg();
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/png'));
}
async function pdfPayload() {
  return { svg: svgString({ fontCss: await fontFaceCss(), prolog: false }), width: dims.w, height: dims.h, background: exportBg() || '' };
}
async function saveFile(filename, data, mime) {
  if (native) {
    try {
      const payload = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
      const ext = filename.split('.').pop().toLowerCase();
      const filterName = { mmd: t('filterMermaid'), json: t('filterBackup') }[ext];
      const r = await native.saveFile(filename, payload, filterName);
      if (r?.status === 'saved') toast(t('savedName', { name: baseName(r.path) }), { action: { label: t('showInFolder'), fn: () => native.showInFolder(r.path) } });
    } catch (e) { toast(t('saveFailed', { msg: e?.message || e }), { kind: 'error', ms: 5000 }); }
    return;
  }
  if (inArtifact()) {
    const dl = await window.claude.use('downloads');
    if (!dl) { toast(t('dlUnavailable'), { kind: 'error' }); return; }
    try { await dl.save({ filename, data }); toast(t('savedName', { name: filename })); }
    catch (e) { if (e?.code !== 'declined') toast(t('dlFailed', { msg: e?.message || e?.code || '' }), { kind: 'error' }); }
    return;
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(t('downloaded', { name: filename }));
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}
function copyText(text, msg) {
  const p = native ? native.copyText(text) : navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : Promise.reject();
  p.then(() => toast(msg), () => {
    const ok = fallbackCopy(text);
    toast(ok ? msg : t('copyFailed'), ok ? {} : { kind: 'error' });
  });
}
const mdBlock = () => '```mermaid\n' + cm.getValue().trimEnd() + '\n```\n';
async function doExport(kind) {
  closeMenus();
  const needsSvg = ['svg', 'png', 'pdf', 'copy-png', 'copy-svg'].includes(kind);
  if (needsSvg && (!stage.querySelector('svg') || !hasGood)) { toast(t('nothingToExport'), { kind: 'error' }); return; }
  const name = safeName(cur().name);
  try {
    if (kind === 'copy-md') return copyText(mdBlock(), t('copiedMd'));
    if (kind === 'copy-svg') return copyText(svgString(), t('copiedSvg'));
    if (kind === 'copy-png') {
      if (native) {
        await native.copyImage(new Uint8Array(await (await pngBlob()).arrayBuffer()));
        return toast(t('copiedPng'));
      }
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('clipboard');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob() })]);
      return toast(t('copiedPng'));
    }
    if (kind === 'svg') return saveFile(name + '.svg', svgString(), 'image/svg+xml');
    if (kind === 'md') return saveFile(name + '.md', `# ${cur().name}\n\n` + mdBlock(), 'text/markdown');
    if (kind === 'mmd') return saveFile(name + '.mmd', cm.getValue(), 'text/plain');
    if (kind === 'png') { toast(t('preparingImage'), { ms: 1200 }); return saveFile(name + '.png', await pngBlob(), 'image/png'); }
    if (kind === 'pdf' && native) { toast(t('preparingPdf'), { ms: 1500 }); return saveFile(name + '.pdf', await native.renderPdf(await pdfPayload()), 'application/pdf'); }
  } catch (e) {
    const tainted = /tainted|insecure|SecurityError/i.test(String(e?.message || e?.name));
    toast(kind === 'copy-png' ? t('copyPngFailed') : tainted ? t('pngTainted') : t('exportFailed', { msg: e?.message || e }), { kind: 'error', ms: 5000 });
  }
}
$$('[data-export]').forEach(b => b.onclick = () => doExport(b.dataset.export));

/* share links (mermaid.live format: pako = zlib deflate, base64url) */
let shareCache = { code: null, live: '', ink: '' };
async function pakoEncode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  return 'pako:' + b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function prepareShare() {
  const code = cm.getValue();
  if (shareCache.code === code) return;
  const enc = await pakoEncode({ code, mermaid: JSON.stringify({ theme: effectiveTheme() }, null, 2), autoSync: true, updateDiagram: true, rough: settings.look === 'handDrawn' });
  shareCache = { code, live: 'https://mermaid.live/edit#' + enc, ink: 'https://mermaid.ink/svg/' + enc };
  $('#shareOpenLive').href = shareCache.live;
}
$('#shareCopyLive').onclick = () => { closeMenus(); copyText(shareCache.live, t('copiedLive')); };
$('#shareCopyInk').onclick = () => { closeMenus(); copyText(shareCache.ink, t('copiedInk')); };
$('#shareOpenLive').addEventListener('click', () => closeMenus());

/* ================= Menus ================= */
function closeMenus() {
  $$('.menu').forEach(m => m.hidden = true);
  $$('[aria-haspopup]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
function toggleMenu(btn, menu, before) {
  const open = menu.hidden;
  closeMenus();
  if (!open) return;
  before?.();
  menu.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  menu.querySelector('.menu-item:not([hidden])')?.focus();
}
$('#btnFile').onclick = e => { e.stopPropagation(); toggleMenu(e.currentTarget, $('#menuFile')); };
$('#btnExport').onclick = e => { e.stopPropagation(); toggleMenu(e.currentTarget, $('#menuExport')); };
$('#btnShare').onclick = e => { e.stopPropagation(); toggleMenu(e.currentTarget, $('#menuShare'), () => prepareShare().catch(() => {})); };
document.addEventListener('click', e => { if (!e.target.closest('.menu-wrap')) closeMenus(); });
$$('.menu').forEach(m => m.addEventListener('keydown', e => {
  if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
  e.preventDefault();
  const items = $$('.menu-item', m).filter(i => !i.hidden), i = items.indexOf(document.activeElement);
  items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
}));
const FILE_ACTIONS = {
  new: newDoc,
  open: openFileDialog,
  save: () => native ? saveCurrent(false) : doExport('mmd'),
  saveAs: () => saveCurrent(true),
  reveal: () => { const d = cur(); if (native && d.path) native.showInFolder(d.path); },
  backup: backupAll,
};
$$('[data-file]').forEach(b => b.onclick = () => { closeMenus(); FILE_ACTIONS[b.dataset.file](); });

/* ================= Help modal & keyboard ================= */
function renderKeys() {
  const K = (...keys) => keys.map(k => `<kbd>${esc(k)}</kbd>`).join('');
  const rows = [
    ['h', 'kGeneral'],
    ...(native ? [['kNew', K(MOD, 'N')]] : []),
    ['kOpen', K(MOD, 'O')], ['kSave', K(MOD, 'S')],
    ...(native ? [['kSaveAs', K(MOD, 'Shift', 'S')]] : []),
    ['kRender', K(MOD, 'Enter')], ['kSide', K(MOD, 'B')], ['kThis', K('?')],
    ['h', 'kEditor'],
    ['kComplete', K('Ctrl', 'Space')], ['kComment', K(MOD, '/')], ['kDup', K(MOD, 'D')],
    ['kMove', K('Alt', '↑') + K('Alt', '↓')], ['kFind', K(MOD, 'F')], ['kReplace', K(MOD, 'H')],
    ['kGoto', K('Alt', 'G')], ['kUndo', K(MOD, 'Z') + K(MOD, 'Y')],
    ['h', 'kPreview'],
    ['kZoom', K('+') + K('−')], ['kFit', K('0')], ['kActual', K('1')], ['kPan', K('←') + K('→') + K('↑') + K('↓')],
    ['kFull', K('F')], ['kWheel', K(t('kWheelKey'))], ['kDrag', K(t('kDragKey'))],
  ];
  $('#keysList').innerHTML = rows.map(([a, b]) => a === 'h'
    ? `<h3>${esc(t(b))}</h3>` : `<div class="key-row"><span>${esc(t(a))}</span><span>${b}</span></div>`).join('');
}
let lastFocus = null;
function openModal() { lastFocus = document.activeElement; $('#helpModal').hidden = false; $('#scrim').hidden = false; $('#scrim').classList.remove('light'); $('#helpClose').focus(); }
function closeModal() { if ($('#helpModal').hidden) return; $('#helpModal').hidden = true; $('#scrim').hidden = true; lastFocus?.focus?.(); }
$('#btnHelp').onclick = openModal;
$('#helpClose').onclick = closeModal;

document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && k === 's') { e.preventDefault(); saveCurrent(e.shiftKey); return; }
  if (mod && k === 'o') { e.preventDefault(); openFileDialog(); return; }
  if (mod && k === 'n' && native) { e.preventDefault(); newDoc(); return; }
  if (mod && e.key === 'Enter') { e.preventDefault(); render(); return; }
  if (mod && k === 'b') { e.preventDefault(); setSide(app.dataset.side !== 'open'); return; }
  if (e.key === 'Escape') { closeMenus(); closeModal(); if (isNarrow() && app.dataset.side === 'open') setSide(false); return; }
  const typing = e.target.closest?.('input, textarea, select, .CodeMirror, [contenteditable]');
  if (!typing && e.key === '?') { e.preventDefault(); openModal(); }
});
window.addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
setInterval(() => { if (settings.panel === 'docs' && app.dataset.side === 'open') renderDocList(); }, 60000);

/* ================= Language ================= */
function applyLanguage() {
  const dir = LANG === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = LANG;
  document.documentElement.dir = dir;
  app.lang = LANG;
  app.dir = dir;
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $('#fileSaveLabel').textContent = t(native ? 'fileSave' : 'fileDownloadMmd');
  $('#exportDlLabel').textContent = t(native ? 'exportSaveFile' : 'exportDownload');
  rtf = new Intl.RelativeTimeFormat(LANG === 'ar' ? 'ar-u-nu-latn' : 'en', { numeric: 'auto' });
  cm.setOption('phrases', CM_PHRASES[LANG] || {});
  cm.setOption('placeholder', '');
  cm.setOption('placeholder', t('editorPlaceholder'));
  if (appVersion) $('#stVersion').title = `${t('appName')} ${appVersion}`;
  renderKeys();
  syncSettingsUI();
  applyUiThemeButton();
  updateFileUI();
  updateMeta();
  updateCursor();
  renderDocList();
  renderTemplates();
  if (settings.panel === 'snippets') renderSnippets();
  renderUpdatePill();
  requestAnimationFrame(() => { cm.refresh(); if (view.autoFit) fit(true); });
}
function setLanguage(lang) {
  if (!I18N[lang] || lang === LANG) return;
  LANG = settings.lang = lang;
  saveSettings();
  applyLanguage();
  if (mermaidApi) render();
  toast(t('langSwitched'));
}
$('#btnLang').onclick = () => setLanguage(LANG === 'ar' ? 'en' : 'ar');

/* ================= Updates (desktop app) ================= */
let appVersion = '', upd = null; // upd: { version, canInstall, phase: available|downloading|ready, percent }
function renderUpdatePill() {
  const p = $('#updatePill');
  if (!upd) { p.hidden = true; return; }
  p.hidden = false;
  p.dataset.state = upd.phase;
  const label = upd.phase === 'downloading' ? t('updDownloading', { p: upd.percent || 0 })
    : upd.phase === 'ready' ? t('updReadyPill') : t('updPill', { v: upd.version });
  p.innerHTML = `${icon('arrow-up')}<span>${esc(label)}</span>`;
}
function onUpdateEvent(ev) {
  if (ev.type === 'available') {
    upd = { version: ev.version, canInstall: ev.canInstall, phase: upd?.phase === 'ready' ? 'ready' : 'available', percent: 0 };
    renderUpdatePill();
    toast(t('updToast', { v: ev.version }), { ms: 10000, action: { label: t(ev.canInstall ? 'updInstall' : 'updPage'), fn: startUpdate } });
  } else if (ev.type === 'none') {
    if (ev.manual) toast(t('updLatest', { v: appVersion }));
  } else if (ev.type === 'error') {
    if (ev.manual) toast(t('updCheckFailed'), { kind: 'error', ms: 5000 });
  } else if (ev.type === 'dev') {
    if (ev.manual) toast(t('updDev'));
  } else if (ev.type === 'progress') {
    if (upd) { upd.phase = 'downloading'; upd.percent = ev.percent; renderUpdatePill(); }
  } else if (ev.type === 'downloaded') {
    upd = { ...(upd || {}), version: ev.version, canInstall: true, phase: 'ready' };
    renderUpdatePill();
    toast(t('updReadyToast', { v: ev.version }), { ms: 12000, action: { label: t('updRestart'), fn: installUpdate } });
  }
}
function startUpdate() {
  if (!upd) return;
  if (!upd.canInstall) { window.open(REPO_URL + '/releases/latest', '_blank'); return; }
  if (upd.phase === 'ready') return installUpdate();
  if (upd.phase === 'downloading') return;
  upd.phase = 'downloading'; upd.percent = 0; renderUpdatePill();
  native.downloadUpdate().catch(e => {
    upd.phase = 'available'; renderUpdatePill();
    toast(t('updFailed', { msg: e?.message || e }), { kind: 'error', ms: 6000 });
  });
}
async function installUpdate() {
  if (!(await confirmUnsaved())) return;
  persist();
  native.installUpdate();
}
$('#updatePill').onclick = startUpdate;
$('#btnCheckUpdate').onclick = () => { if (!native) return; toast(t('updChecking'), { ms: 1500 }); native.checkForUpdates(true); };

/* ================= Boot ================= */
if (inArtifact()) $$('.local-only').forEach(el => el.hidden = true);
$$('.native-only').forEach(el => el.hidden = !native);
if (native) {
  native.onOpenFiles(importTexts);
  native.onUpdate(onUpdateEvent);
  native.onCloseRequest(async () => { if (await confirmUnsaved()) { persist(); native.confirmClose(); } });
  native.version().then(v => { appVersion = v; $('#stVersion').title = `${t('appName')} ${v}`; $('#appVersion').textContent = v; }).catch(() => {});
  if (settings.autoUpdate) setTimeout(() => native.checkForUpdates(false), 5000);
  let lastSync = 0;
  window.addEventListener('focus', () => { if (Date.now() - lastSync > 1500) { lastSync = Date.now(); syncFromDisk(cur()); } });
}
// Hooks for the desktop smoke test (`npm test`); they only reach this page's own state.
window.marsam = Object.freeze({
  templates: MARSAM_TEMPLATES.flatMap(tp => typeof tp.code === 'string'
    ? [{ key: tp.key, code: tp.code }]
    : Object.entries(tp.code).map(([l, code]) => ({ key: `${tp.key}.${l}`, code }))),
  pngSize: async () => (await pngBlob()).size,
  pdf: async () => native ? native.renderPdf(await pdfPayload()) : null,
  setLang: l => setLanguage(l),
  current: () => { const d = cur(); return { name: d.name, path: d.path || null, dirty: isFileDirty(d) }; },
  setCode: code => cm.setValue(code),
  save: () => saveCurrent(false),
});
$('#docName').value = cur().name;
applyEditorPrefs();
applyUiTheme();
applyLayout();
applyLanguage();
$$('.panel').forEach(p => p.hidden = p.dataset.panel !== settings.panel);
setSide(isNarrow() ? false : settings.sideOpen);
updateTone();
applyView();

// A classic <script> (not import()) so it also loads when the page is opened as a file:// URL.
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}
try {
  await loadScript(MERMAID_SRC);
  mermaidApi = window.mermaid?.default ?? window.mermaid;
  if (typeof mermaidApi?.render !== 'function') throw new Error('mermaid global missing');
} catch {
  mermaidApi = null;
  setCanvasMsg(`<strong>${esc(t('mermaidLoadTitle'))}</strong><span>${t('mermaidLoadText')}</span>`);
  $('#stRender').innerHTML = `<span class="bad">●</span> ${esc(t('mermaidMissing'))}`;
}
if (mermaidApi) {
  const f = FONTS[settings.font];
  await Promise.race([
    Promise.all([document.fonts.load('16px "IBM Plex Sans Arabic"', 'عربي Aa'), f.family ? document.fonts.load(`16px "${f.family}"`, 'عربي Aa') : null]).catch(() => {}),
    new Promise(r => setTimeout(r, 2500)),
  ]);
  await render();
  ensureThumbs();
}
})();
