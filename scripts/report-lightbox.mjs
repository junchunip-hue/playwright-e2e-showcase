// Adds a screenshot viewer to a Playwright HTML report (the TypeScript and the Java one alike).
//
// In Playwright's report a click on a screenshot opens the bare image in a new tab. After this script, a click on any
// screenshot (the "Screenshots" section, an image in the attachment list or the failed step's attachment link) opens
// it enlarged over the report, with its name, a button to switch between fit-to-screen and actual size, a download
// button that saves it as a .png named after the step, and "open in new tab". Esc, the × button or a click beside the
// image closes it. Other attachments (trace, video, text) keep Playwright's own behaviour.
//
// Usage: node scripts/report-lightbox.mjs <report-dir>...   (after `playwright merge-reports --reporter html`)
// Idempotent: a report that already has the viewer is left as it is.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MARK = '<!-- report-lightbox -->';

// Runs in the report page. Plain DOM, no framework, so Playwright's own React app is untouched.
const VIEWER = `${MARK}
<style>
#plb{position:fixed;inset:0;z-index:2147483647;background:rgba(15,17,20,.88);display:none;flex-direction:column}
#plb.open{display:flex}
#plb .bar{display:flex;gap:8px;align-items:center;padding:10px 14px;color:#f0f3f6;font:14px/1.4 system-ui,sans-serif}
#plb .name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#plb button,#plb a.btn{background:#2d333b;color:#f0f3f6;border:1px solid #444c56;border-radius:6px;padding:6px 12px;
  font:13px system-ui,sans-serif;cursor:pointer;text-decoration:none}
#plb button:hover,#plb a.btn:hover{background:#373e47}
#plb .stage{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:0 14px 14px}
#plb img{max-width:100%;max-height:100%;object-fit:contain;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.5);cursor:zoom-in}
#plb.actual .stage{align-items:flex-start;justify-content:flex-start}
#plb.actual img{max-width:none;max-height:none;cursor:zoom-out}
</style>
<div id="plb" role="dialog" aria-modal="true" aria-label="Screenshot">
  <div class="bar"><span class="name"></span>
    <button type="button" data-act="size">Actual size</button>
    <a class="btn" data-act="download" download>Download</a>
    <a class="btn" data-act="tab" target="_blank" rel="noopener">Open in new tab</a>
    <button type="button" data-act="close" aria-label="Close">×</button></div>
  <div class="stage"><img alt=""></div>
</div>
<script>
(() => {
  const box = document.getElementById('plb');
  const img = box.querySelector('img');
  const name = box.querySelector('.name');
  const size = box.querySelector('[data-act=size]');
  const download = box.querySelector('[data-act=download]');
  const tab = box.querySelector('[data-act=tab]');
  const isImage = (href) => /\\.(png|jpe?g|webp|gif)([?#]|$)/i.test(href) || /^data:image\\//.test(href);
  const fileName = (label) =>
    (label || 'screenshot').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) + '.png';
  function open(href, label) {
    box.classList.remove('actual');
    size.textContent = 'Actual size';
    img.src = href;
    img.alt = label;
    name.textContent = label;
    download.href = href;
    download.setAttribute('download', fileName(label));
    tab.href = href;
    box.classList.add('open');
    size.focus();
  }
  const close = () => { box.classList.remove('open'); img.removeAttribute('src'); };
  const toggle = () => {
    const actual = box.classList.toggle('actual');
    size.textContent = actual ? 'Fit to screen' : 'Actual size';
  };
  document.addEventListener('click', (e) => {
    if (box.contains(e.target)) return;
    const link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    const href = link.href;
    // Only links to an image: a trace's thumbnail is an image too, but its link opens the trace viewer.
    if (!isImage(href)) return;
    e.preventDefault();
    e.stopPropagation();
    // The thumbnail link has no text: take the attachment's name from the link to the same file in the list.
    const named = [...document.querySelectorAll('a[href]')].find((x) => x.href === href && (x.textContent || '').trim());
    const label = (named ? named.textContent : link.textContent || '').trim() || 'screenshot';
    open(href, label);
  }, true);
  box.addEventListener('click', (e) => {
    const act = e.target.dataset && e.target.dataset.act;
    if (act === 'close' || e.target === box || e.target.classList.contains('stage')) close();
    else if (act === 'size' || e.target === img) toggle();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box.classList.contains('open')) close(); });
})();
</script>`;

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error('Usage: node scripts/report-lightbox.mjs <report-dir>...');
  process.exit(2);
}
for (const dir of dirs) {
  const file = join(dir, 'index.html');
  if (!existsSync(file)) {
    console.warn(`${file}: no report, skipped`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  if (html.includes(MARK)) {
    console.log(`${file}: viewer already there`);
    continue;
  }
  const at = html.lastIndexOf('</body>');
  writeFileSync(file, at >= 0 ? html.slice(0, at) + VIEWER + html.slice(at) : html + VIEWER);
  console.log(`${file}: screenshot viewer added`);
}
