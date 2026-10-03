/**
 * DOM integration test. Runs the real content script against the real test page
 * inside jsdom, with a stubbed chrome.* API.
 *
 * Setup once: npm install --no-save --cache /tmp/ul-npm-cache jsdom
 * Run: node test/dom.js
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch {
  console.log('\n  jsdom not installed — skipping DOM test.');
  console.log('  npm install --no-save --cache /tmp/ul-npm-cache jsdom\n');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'test', 'page.html'), 'utf8');

const SETTINGS = {
  enabled: true,
  system: 'metric',
  precision: 'auto',
  compoundOutput: true,
  underline: 'dotted',
  trigger: 'hover',
  showOriginal: true,
  siteMode: 'all',
  blocklist: []
};

const dom = new JSDOM(html, {
  url: 'https://example.com/test',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});

const { window } = dom;

// minimal chrome.* surface used by the content script
const listeners = [];
window.chrome = {
  storage: {
    sync: {
      get: (_keys, cb) => cb(Object.assign({}, SETTINGS)),
      set: (_o, cb) => cb && cb()
    },
    onChanged: { addListener: (fn) => listeners.push(fn) }
  },
  runtime: { onMessage: { addListener: () => {} } }
};

// jsdom lacks requestIdleCallback; the content script falls back to setTimeout
// only if it's absent, so make sure it is.
delete window.requestIdleCallback;

for (const f of [
  'src/lib/units.js',
  'src/lib/detect.js',
  'src/lib/convert.js',
  'src/content/content.js'
]) {
  window.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
}

let pass = 0;
const failures = [];
const expect = (name, cond, detail) =>
  cond ? pass++ : failures.push(`${name}${detail ? '\n      ' + detail : ''}`);

const clean = (s) => String(s).replace(/\u202f/g, ' ');

setTimeout(() => {
  const doc = window.document;
  const marks = [...doc.querySelectorAll('.ul-measure')].map((e) => ({
    raw: e.getAttribute('data-ul-raw').replace(/\s+/g, ' ').trim(),
    label: clean(e.getAttribute('data-ul-label')),
    cat: e.getAttribute('data-ul-cat')
  }));

  expect('annotated a good number of measurements', marks.length > 35, `found ${marks.length}`);

  const probes = [
    ['26.2 miles', '42.2 km'],
    ['20,310 ft', '6,190 m'],
    ['36 in', '91.4 cm'],
    ['6\'2"', '1.88 m'],
    ['12 nmi', '22.2 km'],
    ['2,400 sq ft', '223 m²'],
    ['0.75 acre', '3,035 m²'],
    ['2 cups', '473.2 mL'],
    ['8 fl oz', '236.6 mL'],
    ['15 gallons', '56.8 L'],
    ['425°F', '218.3 °C'],
    ['62 lbs', '28.1 kg'],
    ['11 st 4 lb', '71.7 kg'],
    ['65 mph', '104.6 km/h'],
    ['32 psi', '220.6 kPa'],
    ['310 hp', '231.2 kW'],
    ['280 lb-ft', '379.6 N·m'],
    ['24 mpg', '9.8 L/100km'],
    ['2,800 fps', '853.4 m/s'],
    ['12 x 8 x 4 in', '30.5 × 20.3 × 10.2 cm']
  ];

  for (const [raw, want] of probes) {
    const hit = marks.find((m) => m.raw === raw);
    expect(
      `"${raw}" → ${want}`,
      hit && hit.label === want,
      hit ? `got "${hit.label}"` : `not annotated (nearby: ${JSON.stringify(marks.slice(0, 3).map((m) => m.raw))})`
    );
  }

  // traps
  const traps = [...doc.querySelectorAll('.neg .ul-measure')].map((e) =>
    e.getAttribute('data-ul-raw')
  );
  expect('zero false positives in trap cards', traps.length === 0, `marked ${JSON.stringify(traps)}`);

  // native metric untouched
  const nativeMarked = [...doc.querySelectorAll('.card')]
    .filter((c) => /42 km long|Oven at 200|90 m²/.test(c.textContent))
    .reduce((n, c) => n + c.querySelectorAll('.ul-measure').length, 0);
  expect('native metric values left alone', nativeMarked === 0, `marked ${nativeMarked}`);

  // text integrity — wrapping must not alter visible text
  const card = [...doc.querySelectorAll('.card')].find((c) => /Boston Marathon/.test(c.textContent));
  expect(
    'visible text preserved exactly',
    card.textContent.trim() === 'The Boston Marathon is 26.2 miles, or 26 miles and 385 yards.',
    JSON.stringify(card.textContent.trim())
  );

  // accessibility attributes
  const first = doc.querySelector('.ul-measure');
  expect('marks are focusable', first.getAttribute('tabindex') === '0');
  expect('marks carry an aria-label', /is about/.test(first.getAttribute('aria-label') || ''));

  // no nested marks (double-processing guard)
  expect(
    'no nested annotations',
    doc.querySelectorAll('.ul-measure .ul-measure').length === 0,
    `nested: ${doc.querySelectorAll('.ul-measure .ul-measure').length}`
  );

  // categories represented
  const cats = new Set(marks.map((m) => m.cat));
  for (const c of ['length', 'area', 'volume', 'mass', 'temperature', 'speed', 'pressure', 'power', 'torque', 'economy']) {
    expect(`category "${c}" detected somewhere`, cats.has(c));
  }

  console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
  if (failures.length) {
    for (const f of failures) console.log('  ✗ ' + f + '\n');
    process.exit(1);
  }
  console.log('  DOM integration OK.\n');
}, 600);
