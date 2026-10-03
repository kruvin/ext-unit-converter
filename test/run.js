/**
 * Node test harness. Run: node test/run.js
 * Loads the browser libs by faking `self`, then asserts detection + conversion.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { performance: { now: () => Date.now() }, console };
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ['src/lib/units.js', 'src/lib/detect.js', 'src/lib/convert.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
}

const UL = sandbox.UL;
const NBSP = '\u202f';
let pass = 0;
const failures = [];

function clean(s) {
  return String(s).replace(new RegExp(NBSP, 'g'), ' ');
}

function settings(over) {
  const s = UL.defaultSettings();
  return Object.assign(s, over, {
    map: Object.assign({}, UL.PRESETS[(over && over.system) || 'metric'].map, (over && over.map) || {})
  });
}

/** Convert the first match in `text` and compare the rendered label. */
function check(text, expected, over) {
  const st = settings(over);
  const matches = UL.findMatches(text, {});
  const results = matches.map((m) => UL.convertMatch(m, st)).filter(Boolean);
  const got = results.length ? clean(results[0].label) : null;
  const ok = expected === null ? got === null : got === expected;
  if (ok) pass++;
  else failures.push(`${JSON.stringify(text)}\n    expected: ${expected}\n    got:      ${got}`);
}

/** Assert the matched source span text. */
function span(text, expected) {
  const matches = UL.findMatches(text, {});
  const got = matches.length ? matches[0].text.trim() : null;
  if (got === expected) pass++;
  else failures.push(`span ${JSON.stringify(text)}\n    expected: ${expected}\n    got:      ${got}`);
}

/** Numeric closeness check on raw conversion. */
function near(fromId, value, toId, expected, tol) {
  const from = UL.BY_ID[fromId];
  const to = UL.BY_ID[toId];
  const got = UL.fromBase(to, UL.toBase(from, value));
  if (Math.abs(got - expected) <= (tol ?? Math.abs(expected) * 1e-4)) pass++;
  else failures.push(`${value} ${fromId} -> ${toId}\n    expected: ${expected}\n    got:      ${got}`);
}

/* ------------------------------------------------------- conversion maths */

near('mi', 1, 'km', 1.609344);
near('ft', 1, 'm', 0.3048);
near('in', 12, 'ft', 1);
near('lb', 1, 'kg', 0.45359237);
near('oz', 16, 'lb', 1);
near('gal', 1, 'l', 3.785411784);
near('gal_uk', 1, 'l', 4.54609);
near('floz', 1, 'ml', 29.5735295625);
near('acre', 1, 'm2', 4046.8564224);
near('ha', 1, 'acre', 2.47105, 1e-4);
near('f', 212, 'c', 100, 1e-9);
near('f', 32, 'c', 0, 1e-9);
near('f', -40, 'c', -40, 1e-9);
near('c', 25, 'k', 298.15, 1e-9);
near('mph', 60, 'kmh', 96.56064, 1e-4);
near('kn', 1, 'kmh', 1.852, 1e-3);
near('psi', 1, 'kpa', 6.894757, 1e-4);
near('bar', 1, 'psi', 14.5038, 1e-3);
near('hp', 1, 'kw', 0.745699872, 1e-6);
near('btu', 1, 'kj', 1.05505585262, 1e-6);
near('kwh', 1, 'kj', 3600, 1e-6);
near('lbft', 1, 'nm_t', 1.3558179483, 1e-6);
near('mpg', 30, 'l100km', 7.8405, 1e-3);
near('l100km', 7.8405, 'mpg', 30, 1e-2);
near('st', 1, 'lb', 14, 1e-6);
near('nmi', 1, 'km', 1.852, 1e-6);

/* ------------------------------------------------------- number parsing */

if (UL.parseNumber('1,234.5') === 1234.5) pass++; else failures.push('parse 1,234.5');
if (Math.abs(UL.parseNumber('1 1/2') - 1.5) < 1e-9) pass++; else failures.push('parse 1 1/2');
if (Math.abs(UL.parseNumber('3/4') - 0.75) < 1e-9) pass++; else failures.push('parse 3/4');
if (Math.abs(UL.parseNumber('2½') - 2.5) < 1e-9) pass++; else failures.push('parse 2½');
if (Math.abs(UL.parseNumber('½') - 0.5) < 1e-9) pass++; else failures.push('parse ½');

/* ------------------------------------------------------------- detection */

span('It is 26.2 miles long.', '26.2 miles');
span('He is 6\'2" tall.', '6\'2"');
span('Set oven to 425°F now.', '425°F');
span('A 12 ft x 16 ft deck.', '12 ft x 16 ft');
span('Between 5-10 km of trail.', '5-10 km');

/* ------------------------------------------- conversions (metric reader) */

check('It is 26.2 miles long.', '42.2 km');
check('The climb is 1,200 ft.', '365.8 m');
check('He weighs 185 lbs.', '83.9 kg');
check('Set oven to 425°F.', '218.3 °C');
check('Cruising at 65 mph.', '104.6 km/h');
check('Tires at 32 psi.', '220.6 kPa');
check('Add 2 cups of stock.', '473.2 mL');
check('About 8 fl oz of cream.', '236.6 mL');
check('The lot is 0.75 acres.', '3,035 m²');
check('A 1,800 sq ft house.', '167.2 m²');
check('Rated at 310 hp.', '231.2 kW');
check('Torque of 280 lb-ft.', '379.6 N·m');
check('It gets 24 mpg.', '9.8 L/100km');
check('Uses 1,500 BTU.', '1,583 kJ');
check('He is 6\'2" tall.', '1.88 m');
check('She weighs 11 st 4 lb.', '71.7 kg');
check('A 12 ft x 16 ft deck.', '3.66 × 4.88 m');
check('Between 5-10 miles.', '8.05–16.1 km');
check('Add 1½ tbsp of oil.', '22.2 mL');
check('A 14,115 ft summit.', '4,302 m');

/* -------------------------------------------- already-native: no tooltip */

check('It is 42 km long.', null);
check('Set oven to 220°C.', null);
check('He weighs 84 kg.', null);
check('Driving at 100 km/h.', null);

/* ----------------------------------------------- conversions (US reader) */

check('It is 42 km long.', '26.1 mi', { system: 'us' });
check('Set oven to 220°C.', '428 °F', { system: 'us' });
check('He weighs 84 kg.', '185.2 lb', { system: 'us' });
check('A 2 litre bottle.', '2.11 qt', { system: 'us' });
check('He is 1.88 m tall.', '6 ft 2 in', { system: 'us' });
check('Driving at 100 km/h.', '62.1 mph', { system: 'us' });
check('A 90 m² flat.', '968.8 ft²', { system: 'us' });
check('Uses 7.8 L/100km.', '30.2 mpg', { system: 'us' });

/* --------------------------------------------- conversions (UK reader) */

check('He weighs 84 kg.', '13 st 3 lb', { system: 'uk' });
check('It is 42 km long.', '26.1 mi', { system: 'uk' });
check('Set oven to 425°F.', '218.3 °C', { system: 'uk' });

/* ------------------------------------------------------ false positives */

check('We raised 5 m in funding.', null);
check('It took 5 minutes.', null);
check('Costs $5 in total.', null);
check('Version 1.2 in beta.', null);
check('Born in 1999.', null);
check('Scored 5 points.', null);
check('He ranked 5th in class.', null);
check('Chapter 5 in the book.', null);
check('The Model 3 in white.', null);
check('Only 100K users.', null);
check('Interested in 5 things.', null);

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.log('  ✗ ' + f + '\n');
  process.exit(1);
}
console.log('  All green.\n');
