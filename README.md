# Unit Lens

A Chrome (MV3) extension that finds measurements on any page and shows a hover tooltip
converting them into the units you actually read.

You tell it your system once — **Metric**, **US customary**, **UK/Imperial hybrid**, or a
custom per-category mix — and anything foreign gets a subtle dotted underline. Hover it to
see the conversion; click to copy. Values already in your units are left completely alone.

![Unit Lens icon](icons/icon128.png)

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this folder
4. The options page opens on first install — pick your system

Open `test/page.html` in the browser to see it working against a page full of edge cases.

## What it converts

| Category | Examples |
| --- | --- |
| Length & distance | in, ft, yd, mi, nmi, fathom, furlong, mm–km, ly, AU |
| Area | sq in/ft/yd/mi, acres, ha, mm²–km² |
| Volume & liquids | tsp, tbsp, cups, fl oz, pints, quarts, gallons (US **and** imperial), cu in/ft/yd, mL–kL, barrels |
| Weight & mass | oz, lb, stone, short/long/metric tons, grains, carats, mg–kg |
| Temperature | °F, °C, K, °R |
| Speed | mph, km/h, ft/s, m/s, knots, Mach |
| Pressure | psi, kPa, bar, atm, mmHg, inHg, mbar |
| Energy | BTU, cal, kcal, J–MJ, Wh, kWh |
| Power | hp, PS, W–MW, BTU/h |
| Torque | lb-ft, lb-in, N·m, kgf·m |
| Fuel economy | mpg (US & imperial), L/100km, km/L |

It handles the messy real-world forms too:

- `5'11"`, `6 ft 2 in`, `11 st 4 lb`, `6 lb 4 oz` — compound measurements
- `1½ tbsp`, `3/4 in`, `2 ½ cups` — fractions and vulgar fractions
- `5-10 miles`, `2 to 4 inches` — ranges
- `12 ft x 16 ft`, `12 x 8 x 4 in` — dimension chains
- `1,200 ft`, `-10°F`, `425 °F` — separators, negatives, spacing variants

Output is phrased the way people actually speak: `1.88 m` becomes `6 ft 2 in` for a US
reader, and `84 kg` becomes `13 st 3 lb` for a UK one.

## Avoiding false positives

The hard part isn't the maths, it's not mangling ordinary text. A few of the guards:

- **Ambiguous short tokens** (`m`, `g`, `t`, `in`, `pt`, `cal`, `bar`, `ton`) require real
  context. `We raised 5 m in funding`, `3 in stock`, `12 pt bold`, and `100K users` all stay
  plain, while `36 in wide` and `2 in diameter` convert.
- **Currency and identifiers** are skipped: `$5M`, `version 1.2`, `Seat 32 F`, `Flight AA 100`.
- **Word boundaries** are enforced on both sides, so `5 minutes` never reads as `5 m`.
- Bare `C`/`F` need a degree sign or to be glued to the number.
- `<script>`, `<style>`, `<code>`, inputs, and `contenteditable` regions are never touched.

These rules are pinned down by `test/adversarial.js`, which asserts ~45 tricky strings
produce **zero** conversions while 30 genuine measurements still convert.

## Settings

The popup covers the common cases (system, trigger mode, per-site disable, live count).
The options page adds:

- **Per-category target system** — e.g. metric everywhere but keep temperature in °F
- **Trigger** — hover, click, or always-inline `(≈ 42.2 km)`
- **Precision** — automatic (magnitude-aware) or a fixed 0–3 decimals
- **Highlight style** — dotted, dashed, solid, or a subtle background
- **Natural compounds** — toggle `6 ft 2 in` vs `6.17 ft`
- **Site list** — run everywhere except a blocklist, or only on an allowlist
- **Live preview** — edit text and watch detection run on it in real time

Settings use `chrome.storage.sync`, so they follow your profile and open tabs update instantly.

## Tests

```bash
npm install          # jsdom, for the DOM test only
npm test
```

| Suite | What it covers |
| --- | --- |
| `test/run.js` | 82 assertions — conversion factors, number parsing, span detection, all three reader systems |
| `test/adversarial.js` | 73 assertions — false-positive traps vs. must-detect measurements |
| `test/dom.js` | 37 assertions — runs the real content script over `test/page.html` in jsdom: annotation, text integrity, a11y attributes, no nested marks |
| `test/ui.js` | 23 assertions — popup and options pages render and persist settings against a stubbed `chrome.*` API |

All four pass with zero failures (215 assertions). They caught several real bugs during
development, including a 1000× error in the Wh/kWh factors and a temporal dead zone crash
in the content script's scheduler.

## Implementation notes

```
manifest.json           MV3 manifest — storage + activeTab only, no host permissions
src/lib/units.js        ~120 units across 11 categories, factors + target ladders
src/lib/detect.js       regex engine: numbers, fractions, compounds, ranges, dimensions
src/lib/convert.js      magnitude-aware target selection and formatting
src/content/content.js  TreeWalker scan, chunked annotation, tooltip, MutationObserver
src/options, src/popup  settings UI
tools/make_icons.py     dependency-free PNG icon generator
```

A few decisions worth calling out:

- **Target units are chosen by magnitude**, not fixed pairs — `0.5 in` → `12.7 mm` but
  `26.2 mi` → `42.2 km`. Ladders are also *source-aware*, so `20,310 ft` becomes `6,190 m`
  (mountain height) rather than a useless `6.19 km`.
- **Scanning is chunked** through `requestIdleCallback` with a 12 ms budget per frame, capped
  at 4,000 marks, so large pages never jank.
- **Dynamic pages** are handled by a debounced `MutationObserver`, and open shadow roots are
  walked too.
- **No host permissions** are requested — the content script is declarative and the extension
  makes zero network requests. Nothing leaves your machine.

## Known limitations

- Currency is deliberately out of scope (it needs live exchange rates).
- Text split across multiple elements (`<b>5</b> miles`) isn't joined before matching.
- Closed shadow roots and cross-origin iframes are inaccessible to content scripts.
- `cal` is read as the small calorie; food labels usually mean `kcal`. Capitalised `Cal` is
  handled correctly.

## License

[BSD 3-Clause](LICENSE) © 2026 Nizzan Kruvi
