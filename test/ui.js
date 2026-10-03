/**
 * Smoke-test the popup and options pages in jsdom with a stubbed chrome.* API.
 * Catches broken selectors, missing elements, and render-time exceptions.
 *
 * Run: node test/ui.js
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch {
  console.log('\n  jsdom not installed — skipping UI test.\n');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
let pass = 0;
const failures = [];
const expect = (name, cond, detail) =>
  cond ? pass++ : failures.push(`${name}${detail ? '\n      ' + detail : ''}`);

function makeChrome(store) {
  return {
    storage: {
      sync: {
        get: async () => Object.assign({}, store),
        set: async (o) => Object.assign(store, o),
        clear: async () => Object.keys(store).forEach((k) => delete store[k])
      },
      onChanged: { addListener: () => {} }
    },
    runtime: { openOptionsPage: () => (store.__optionsOpened = true) },
    tabs: {
      query: async () => [{ id: 1, url: 'https://example.com/page' }],
      sendMessage: async () => ({ count: 7 })
    },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} }
  };
}

/** Load an extension HTML page, inlining its local <script> tags. */
async function loadPage(relHtml, store) {
  const dir = path.dirname(path.join(ROOT, relHtml));
  const html = fs.readFileSync(path.join(ROOT, relHtml), 'utf8');

  const dom = new JSDOM(html, { url: 'chrome-extension://abc/page.html', runScripts: 'outside-only' });
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.error || e.message)));
  window.chrome = makeChrome(store);

  for (const tag of [...window.document.querySelectorAll('script[src]')]) {
    const file = path.resolve(dir, tag.getAttribute('src'));
    try {
      window.eval(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      errors.push(`${tag.getAttribute('src')}: ${err.message}`);
    }
  }

  await new Promise((r) => setTimeout(r, 120));
  return { window, doc: window.document, errors };
}

(async () => {
  /* ------------------------------------------------------------------ popup */
  {
    const store = { enabled: true, system: 'us', trigger: 'hover', blocklist: [] };
    const { doc, errors, window } = await loadPage('src/popup/popup.html', store);

    expect('popup loads without errors', errors.length === 0, errors.join('; '));
    expect('popup reflects stored system', doc.getElementById('system').value === 'us');
    expect('popup enable switch is checked', doc.getElementById('enabled').checked === true);
    expect('popup shows a hint', doc.getElementById('systemHint').textContent.length > 5);
    expect(
      'popup shows live count from content script',
      doc.getElementById('count').textContent === '7',
      `got "${doc.getElementById('count').textContent}"`
    );
    expect(
      'popup site button names the host',
      /example\.com/.test(doc.getElementById('toggleSite').textContent),
      doc.getElementById('toggleSite').textContent
    );
    expect(
      'popup marks the active trigger',
      doc.querySelector('#trigger button[data-v="hover"]').getAttribute('aria-pressed') === 'true'
    );

    // toggling the switch persists
    const sw = doc.getElementById('enabled');
    sw.checked = false;
    sw.dispatchEvent(new window.Event('change'));
    await new Promise((r) => setTimeout(r, 60));
    expect('popup persists enable toggle', store.enabled === false, JSON.stringify(store.enabled));

    // switching trigger persists
    doc.querySelector('#trigger button[data-v="inline"]').dispatchEvent(
      new window.MouseEvent('click', { bubbles: true })
    );
    await new Promise((r) => setTimeout(r, 60));
    expect('popup persists trigger choice', store.trigger === 'inline', String(store.trigger));

    // disabling the current site adds it to the blocklist
    doc.getElementById('toggleSite').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    expect(
      'popup adds host to blocklist',
      (store.blocklist || []).includes('example.com'),
      JSON.stringify(store.blocklist)
    );
  }

  /* ---------------------------------------------------------------- options */
  {
    const store = { enabled: true, system: 'metric', blocklist: ['foo.com'] };
    const { doc, errors, window } = await loadPage('src/options/options.html', store);

    expect('options loads without errors', errors.length === 0, errors.join('; '));

    const sysButtons = doc.querySelectorAll('#systems .sys');
    expect('options renders system cards', sysButtons.length === 4, `got ${sysButtons.length}`);
    expect(
      'options highlights the active system',
      [...sysButtons].some((b) => b.getAttribute('aria-pressed') === 'true')
    );

    const catRows = doc.querySelectorAll('#cats .cat');
    expect('options renders every category', catRows.length === 11, `got ${catRows.length}`);
    expect(
      'category rows show a worked example',
      /→/.test(doc.querySelector('#cats .cat-ex').textContent),
      doc.querySelector('#cats .cat-ex').textContent
    );

    expect('options prefills the site list', doc.getElementById('blocklist').value === 'foo.com');

    const pv = doc.querySelectorAll('#previewOut .pv');
    expect('live preview annotates the sample', pv.length > 5, `got ${pv.length}`);
    expect(
      'preview carries conversion labels',
      /≈/.test(doc.querySelector('#previewOut .pv').getAttribute('data-label') || '')
    );

    // flipping a category persists and disables its select
    const cb = doc.getElementById('cat-temperature');
    cb.checked = false;
    cb.dispatchEvent(new window.Event('change'));
    await new Promise((r) => setTimeout(r, 80));
    expect(
      'options persists a disabled category',
      store.categories && store.categories.temperature === false,
      JSON.stringify(store.categories)
    );

    // per-category system override switches the preset to custom
    const sel = doc.querySelector('#cats .cat select');
    sel.value = 'us';
    sel.dispatchEvent(new window.Event('change'));
    await new Promise((r) => setTimeout(r, 80));
    expect('per-category override switches to custom', store.system === 'custom', String(store.system));

    // unit reference toggles
    doc.getElementById('toggleRef').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect('unit reference expands', doc.getElementById('ref').hidden === false);
    expect(
      'unit reference lists groups',
      doc.querySelectorAll('#ref .ref-group').length === 11,
      `got ${doc.querySelectorAll('#ref .ref-group').length}`
    );
    expect(
      'unit count is reported',
      /units across 11 categories/.test(doc.getElementById('unitCount').textContent),
      doc.getElementById('unitCount').textContent
    );
  }

  console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
  if (failures.length) {
    for (const f of failures) console.log('  ✗ ' + f + '\n');
    process.exit(1);
  }
  console.log('  UI pages OK.\n');
})();
