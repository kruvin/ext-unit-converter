/** Unit Lens — options controller. */
(function () {
  'use strict';

  const UL = self.UL;
  const $ = (id) => document.getElementById(id);
  let settings = UL.defaultSettings();

  const SAMPLE = [
    'The trail climbs 1,200 ft over 3.5 miles, topping out at 14,115 feet.',
    'He is 6\'2" and weighs 185 lbs; she runs a 6:30 mile at 68°F.',
    'Add 2 cups of stock, 1½ tbsp of oil and 8 fl oz of cream.',
    'The lot is 0.75 acres; the deck is 12 ft x 16 ft and the shed 48 sq ft.',
    'Tires at 32 psi, towing 5,000 lbs, 310 hp and 280 lb-ft, rated 24 mpg.'
  ].join('\n');

  /* ---------------------------------------------------------------- systems */

  function renderSystems() {
    const box = $('systems');
    box.textContent = '';
    for (const [key, preset] of Object.entries(UL.PRESETS)) {
      const b = document.createElement('button');
      b.className = 'sys';
      b.type = 'button';
      b.setAttribute('aria-pressed', String(settings.system === key));
      const strong = document.createElement('strong');
      strong.textContent = preset.label;
      const span = document.createElement('span');
      span.textContent = preset.hint;
      b.append(strong, span);
      b.addEventListener('click', () => {
        const patch = { system: key };
        if (key !== 'custom') patch.map = Object.assign({}, UL.PRESETS[key].map);
        save(patch);
      });
      box.appendChild(b);
    }
  }

  /* ------------------------------------------------------------- categories */

  const EXAMPLES = {
    length: '26.2 miles',
    area: '1,800 sq ft',
    volume: '2 pints',
    mass: '14 oz',
    temperature: '425°F',
    speed: '65 mph',
    pressure: '32 psi',
    energy: '1,500 BTU',
    power: '300 hp',
    torque: '280 lb-ft',
    economy: '31 mpg'
  };

  function renderCats() {
    const box = $('cats');
    box.textContent = '';
    for (const [cat, meta] of Object.entries(UL.CATEGORIES)) {
      const on = settings.categories[cat] !== false;
      const row = document.createElement('div');
      row.className = 'cat' + (on ? '' : ' off');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = on;
      cb.id = `cat-${cat}`;
      cb.addEventListener('change', () => {
        const cats = Object.assign({}, settings.categories, { [cat]: cb.checked });
        save({ categories: cats });
      });

      const label = document.createElement('label');
      label.setAttribute('for', `cat-${cat}`);
      const name = document.createElement('span');
      name.className = 'cat-name';
      name.textContent = meta.label;
      const ex = document.createElement('span');
      ex.className = 'cat-ex';
      ex.textContent = previewFor(cat);
      label.append(name, ex);

      const sel = document.createElement('select');
      for (const sys of ['metric', 'us', 'uk']) {
        const o = document.createElement('option');
        o.value = sys;
        o.textContent = { metric: 'Metric', us: 'US', uk: 'Imperial' }[sys];
        sel.appendChild(o);
      }
      sel.value = UL.targetSystemFor(settings, cat);
      sel.disabled = !on;
      sel.addEventListener('change', () => {
        const map = Object.assign({}, settings.map, { [cat]: sel.value });
        save({ map, system: 'custom' });
      });

      row.append(cb, label, sel);
      box.appendChild(row);
    }
  }

  /** "425°F → 218°C" style hint for a category row. */
  function previewFor(cat) {
    const sample = EXAMPLES[cat];
    const matches = UL.findMatches(sample, {});
    if (!matches.length) return sample;
    const probe = Object.assign({}, settings, {
      categories: Object.assign({}, settings.categories, { [cat]: true })
    });
    const conv = UL.convertMatch(matches[0], probe);
    return conv ? `${sample} → ${conv.label}` : `${sample} (already native)`;
  }

  /* ---------------------------------------------------------------- preview */

  function renderPreview() {
    const text = $('previewIn').value;
    const out = $('previewOut');
    out.textContent = '';
    let total = 0;

    for (const line of text.split('\n')) {
      const p = document.createElement('div');
      const matches = UL.findMatches(line, {});
      let cursor = 0;
      for (const m of matches) {
        const conv = UL.convertMatch(m, settings);
        if (!conv) continue;
        if (m.start > cursor) p.appendChild(document.createTextNode(line.slice(cursor, m.start)));
        const span = document.createElement('span');
        span.className = 'pv';
        span.setAttribute('data-label', '≈ ' + conv.label);
        span.textContent = line.slice(m.start, m.end);
        p.appendChild(span);
        cursor = m.end;
        total++;
      }
      if (cursor < line.length) p.appendChild(document.createTextNode(line.slice(cursor)));
      out.appendChild(p);
    }

    if (!total) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'Nothing to convert — everything here is already in your units.';
      out.appendChild(e);
    }
  }

  /* -------------------------------------------------------------- reference */

  function renderRef() {
    const box = $('ref');
    box.textContent = '';
    const byCat = {};
    for (const unit of UL.UNITS) (byCat[unit.cat] = byCat[unit.cat] || []).push(unit);
    for (const [cat, meta] of Object.entries(UL.CATEGORIES)) {
      const g = document.createElement('div');
      g.className = 'ref-group';
      const h = document.createElement('h3');
      h.textContent = meta.label;
      const p = document.createElement('p');
      const seen = new Set();
      for (const unit of byCat[cat] || []) {
        if (seen.has(unit.symbol)) continue;
        seen.add(unit.symbol);
        const c = document.createElement('code');
        c.textContent = unit.symbol;
        p.append(c, document.createTextNode(' '));
      }
      g.append(h, p);
      box.appendChild(g);
    }
    $('unitCount').textContent = `${UL.UNITS.length} units across ${Object.keys(UL.CATEGORIES).length} categories.`;
  }

  /* ------------------------------------------------------------------- save */

  let statusTimer = null;
  async function save(patch) {
    settings = Object.assign(settings, patch);
    await chrome.storage.sync.set(patch);
    renderAll();
    $('status').textContent = 'Saved — open tabs update instantly.';
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => ($('status').textContent = ''), 2200);
  }

  function renderAll() {
    renderSystems();
    renderCats();
    $('trigger').value = settings.trigger || 'hover';
    $('precision').value = String(settings.precision ?? 'auto');
    $('underline').value = settings.underline || 'dotted';
    $('compoundOutput').checked = settings.compoundOutput !== false;
    $('showOriginal').checked = settings.showOriginal !== false;
    $('siteMode').value = settings.siteMode || 'all';
    renderPreview();
  }

  /* ----------------------------------------------------------------- events */

  $('trigger').addEventListener('change', (e) => save({ trigger: e.target.value }));
  $('precision').addEventListener('change', (e) => save({ precision: e.target.value }));
  $('underline').addEventListener('change', (e) => save({ underline: e.target.value }));
  $('compoundOutput').addEventListener('change', (e) => save({ compoundOutput: e.target.checked }));
  $('showOriginal').addEventListener('change', (e) => save({ showOriginal: e.target.checked }));
  $('siteMode').addEventListener('change', (e) => save({ siteMode: e.target.value }));
  $('previewIn').addEventListener('input', renderPreview);

  $('allOn').addEventListener('click', () => {
    const cats = {};
    for (const c of Object.keys(UL.CATEGORIES)) cats[c] = true;
    save({ categories: cats });
  });

  let blockTimer = null;
  $('blocklist').addEventListener('input', (e) => {
    clearTimeout(blockTimer);
    const list = e.target.value.split('\n').map((s) => s.trim().replace(/^www\./, '')).filter(Boolean);
    blockTimer = setTimeout(() => save({ blocklist: list }), 500);
  });

  $('toggleRef').addEventListener('click', () => {
    const ref = $('ref');
    ref.hidden = !ref.hidden;
    $('toggleRef').textContent = ref.hidden ? 'Show' : 'Hide';
  });

  $('reset').addEventListener('click', async () => {
    const defaults = UL.defaultSettings();
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set(defaults);
    settings = defaults;
    $('blocklist').value = '';
    $('previewIn').value = SAMPLE;
    renderAll();
    $('status').textContent = 'Reset to defaults.';
  });

  /* ------------------------------------------------------------------- init */

  (async () => {
    const stored = await chrome.storage.sync.get(null);
    settings = Object.assign(UL.defaultSettings(), stored || {});
    if (!settings.map) settings.map = Object.assign({}, UL.PRESETS[settings.system].map);
    $('previewIn').value = SAMPLE;
    $('blocklist').value = (settings.blocklist || []).join('\n');
    renderAll();
    renderRef();
  })();
})();
