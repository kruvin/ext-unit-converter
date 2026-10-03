/**
 * False-positive stress test. Run: node test/adversarial.js
 * Every string here must produce ZERO conversions for a metric reader.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { performance: { now: () => Date.now() }, console };
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const f of ['src/lib/units.js', 'src/lib/detect.js', 'src/lib/convert.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
}
const UL = sandbox.UL;

const MUST_BE_SILENT = [
  // money & finance
  'We raised $5M in Series A funding.',
  'Revenue hit 12 m last quarter.',
  'The deal is worth 4.5 bn.',
  'It costs $20 in shipping.',
  'Priced at £15 in stores.',
  // counts & abbreviations
  'The video got 100K views.',
  'Over 2 m people watched.',
  'She has 50 k followers.',
  'Only 3 in stock.',
  'Interested in 5 things.',
  '4 in 10 people agree.',
  'Ranked 7 in the league.',
  'Chapter 12 in volume 2.',
  'Page 45 in the manual.',
  'Room 12 C is upstairs.',
  'Seat 32 F on the flight.',
  'Gate 5 F opens soon.',
  // time
  'It took 5 minutes.',
  'Wait 30 m before serving.',
  'A 90 min film.',
  'Published 5 h ago.',
  // versions, codes, IDs
  'Running version 1.2 in production.',
  'Model 3 in Pearl White.',
  'Flight AA 100 to Boston.',
  'Part no. 4502 in the catalog.',
  'ISO 9001 in effect.',
  // sports & misc
  'He scored 25 points in the game.',
  'A 3 pt shot at the buzzer.',
  'The font is 12 pt bold.',
  'Set margin to 10 pt here.',
  'She finished 2 st in the race.',
  'Won 5 in a row.',
  'The bar closes at 2.',
  'Raise the bar in 2026.',
  // years / dates
  'Born in 1999 in Ohio.',
  'The 1920s in America.',
  // ambiguous "in" that must stay plain even near dimension-ish words
  'There are 3 in stock in the warehouse.',
  'Only 2 in total remain.',
  'We have 6 in reserve.',
  'Put 4 in there.',
  // already metric (nothing to do for a metric reader)
  'It is 42 km away.',
  'Weighs 3 kg exactly.',
  'Oven at 200 °C.',
  'A 1.5 L bottle.',
  'Driving 120 km/h.',
  'A 90 m² apartment.'
];

const st = UL.defaultSettings();
let pass = 0;
const failures = [];

for (const text of MUST_BE_SILENT) {
  const hits = UL.findMatches(text, {})
    .map((m) => ({ m, c: UL.convertMatch(m, st) }))
    .filter((x) => x.c);
  if (!hits.length) pass++;
  else {
    failures.push(
      `${JSON.stringify(text)}\n      matched ${JSON.stringify(hits[0].m.text)} -> ${hits[0].c.label}`
    );
  }
}

/* These MUST still be detected — guard against over-correcting. */
const MUST_DETECT = [
  'A 26.2 mile marathon.',
  'The room is 12 ft wide.',
  'Bake at 350 °F.',
  'He is 5\'10".',
  'Weighs 12 oz.',
  'Holds 5 gallons.',
  'Towing 5,000 lbs.',
  'Runs at 70 mph.',
  'Inflate to 35 psi.',
  'A 2,400 sq ft home.',
  'Spans 0.5 acres.',
  'Add 3 tbsp of sugar.',
  'A 1/2 cup of milk.',
  'Produces 450 hp.',
  'Gets 32 mpg.',
  'Drops to -10 °F.',
  'A 1,500 BTU heater.',
  'Rated 300 lb-ft.',
  'About 3.5 miles away.',
  'Roughly 6 feet deep.',
  // ambiguous "in" rescued by a dimensional word
  'A 36 in wide doorway.',
  'The pipe is 2 in diameter.',
  'Cut it 18 in long.',
  'Boards 2 in thick.',
  // specialist units everyone benefits from
  'A 12 nmi exclusion zone.',
  'Gusting to 40 knots.',
  'Muzzle velocity of 2,800 fps.'
];

for (const text of MUST_DETECT) {
  const hits = UL.findMatches(text, {})
    .map((m) => UL.convertMatch(m, st))
    .filter(Boolean);
  if (hits.length) pass++;
  else failures.push(`MISSED: ${JSON.stringify(text)}`);
}

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.log('  ✗ ' + f + '\n');
  process.exit(1);
}
console.log('  No false positives.\n');
