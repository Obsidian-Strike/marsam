// Copies every runtime dependency from node_modules into app/vendor, so the editor
// runs fully offline — both inside the desktop app and when index.html is opened directly.
// Runs automatically after `npm install`.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nm = (...p) => path.join(root, 'node_modules', ...p);
const out = path.join(root, 'app', 'vendor');
await fs.mkdir(out, { recursive: true });

// Mermaid: the single-file build (ELK layout included), loadable from file:// URLs.
await fs.copyFile(nm('mermaid', 'dist', 'mermaid.min.js'), path.join(out, 'mermaid.min.js'));

// CodeMirror 5 and the addons the editor uses, concatenated in load order.
const CM_FILES = [
  'lib/codemirror.js',
  'addon/mode/simple.js',
  'addon/edit/matchbrackets.js',
  'addon/edit/closebrackets.js',
  'addon/selection/active-line.js',
  'addon/comment/comment.js',
  'addon/dialog/dialog.js',
  'addon/search/searchcursor.js',
  'addon/search/search.js',
  'addon/search/jump-to-line.js',
  'addon/hint/show-hint.js',
  'addon/display/placeholder.js',
];
let cm = '/* CodeMirror 5 + addons — MIT License, (c) Marijn Haverbeke and others. https://codemirror.net/5/ */\n';
for (const f of CM_FILES) cm += `\n/* ---- ${f} ---- */\n` + (await fs.readFile(nm('codemirror', f), 'utf8')) + '\n';
await fs.writeFile(path.join(out, 'codemirror.bundle.js'), cm);

// Fonts: Arabic + Latin subsets as data URIs. Data URIs (rather than font files) let
// PNG export embed the same fonts into the SVG it rasterises.
const FONTS = [
  ['IBM Plex Sans Arabic', 'ibm-plex-sans-arabic', [400, 500, 600, 700]],
  ['Noto Kufi Arabic', 'noto-kufi-arabic', [400, 600, 700]],
  ['JetBrains Mono', 'jetbrains-mono', [400, 500]],
];
const SUBSETS = new Set(['arabic', 'latin']);
const fontCss = {};
for (const [family, pkg, weights] of FONTS) {
  const blocks = [];
  for (const w of weights) {
    const css = await fs.readFile(nm('@fontsource', pkg, `${w}.css`), 'utf8');
    for (const m of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
      const subset = m[1].slice(pkg.length + 1, -`-${w}-normal`.length);
      if (!SUBSETS.has(subset)) continue;
      const file = m[2].match(/url\(\.\/(files\/[^)]+\.woff2)\)/)[1];
      const range = m[2].match(/unicode-range:\s*([^;]+);/)[1].trim();
      const data = (await fs.readFile(nm('@fontsource', pkg, file))).toString('base64');
      blocks.push(`@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${data}) format('woff2');unicode-range:${range}}`);
    }
  }
  if (!blocks.length) throw new Error(`no font faces found for ${family}`);
  fontCss[family] = blocks.join('\n');
}
await fs.writeFile(path.join(out, 'fonts.js'), `/* IBM Plex Sans Arabic, Noto Kufi Arabic, JetBrains Mono — SIL Open Font License 1.1 (via @fontsource). */
(function () {
  var F = ${JSON.stringify(fontCss)};
  window.MARSAM_FONT_CSS = F;
  var s = document.createElement('style');
  s.id = 'marsam-fonts';
  s.textContent = Object.keys(F).map(function (k) { return F[k]; }).join('\\n');
  document.head.appendChild(s);
})();
`);

const version = async p => JSON.parse(await fs.readFile(nm(p, 'package.json'), 'utf8')).version;
await fs.writeFile(path.join(out, 'LICENSES.txt'), `Third-party files bundled with Marsam (مرسم)

mermaid.min.js        Mermaid ${await version('mermaid')} — MIT License — https://github.com/mermaid-js/mermaid
codemirror.bundle.js  CodeMirror ${await version('codemirror')} and addons — MIT License — https://codemirror.net/5/
fonts.js              IBM Plex Sans Arabic, Noto Kufi Arabic, JetBrains Mono — SIL Open Font License 1.1
                      packaged by Fontsource (https://fontsource.org) — https://openfontlicense.org
`);

for (const f of await fs.readdir(out)) console.log(`vendor/${f}`.padEnd(32), ((await fs.stat(path.join(out, f))).size / 1024).toFixed(0).padStart(6), 'KB');
