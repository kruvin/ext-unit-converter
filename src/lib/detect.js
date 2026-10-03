/**
 * Unit Lens — detection engine.
 * Finds measurement spans in a plain-text string.
 *
 * Output: [{ start, end, text, kind, parts: [{unit, value}], joiner }]
 *   kind: 'single' | 'range' | 'dimension' | 'compound'
 */
(function () {
  'use strict';

  const UL = (self.UL = self.UL || {});

  /* -------------------------------------------------------------- numbers */

  const VULGAR = {
    '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
    '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6,
    '⅐': 1 / 7, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
    '⅑': 1 / 9, '⅒': 0.1
  };
  const VULGAR_CLASS = Object.keys(VULGAR).join('');

  // 1,234.56 | 1234.56 | .5 | 1 1/2 | 3/4 | 2½ | ½
  const NUM = String.raw`(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)`;
  const NUMBER = String.raw`(?:${NUM}\s*[${VULGAR_CLASS}]|${NUM}\s+\d+\s*\/\s*\d+|${NUM}\s*\/\s*\d+|${NUM}|[${VULGAR_CLASS}])`;

  /** Parse a matched number string (handles commas, fractions, vulgars). */
  function parseNumber(raw) {
    let s = raw.trim().replace(/,(?=\d{3}\b)/g, '');
    let total = 0;

    // trailing/standalone vulgar fraction
    const vulgarRe = new RegExp(`[${VULGAR_CLASS}]`);
    const vm = s.match(vulgarRe);
    if (vm) {
      total += VULGAR[vm[0]];
      s = s.replace(vulgarRe, '').trim();
      if (!s) return total;
    }

    // mixed number "1 1/2" or simple fraction "3/4"
    const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) return total + Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

    const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (frac) return total + Number(frac[1]) / Number(frac[2]);

    const n = Number(s);
    return Number.isFinite(n) ? total + n : total;
  }

  /* ---------------------------------------------------------------- tokens */

  /**
   * Tokens that are also ordinary English words / common abbreviations.
   * They only count as units with strong supporting context:
   * an abbreviation period, a quote mark, a compound, or a dimension chain.
   */
  const STRICT = new Set([
    'in', 'ins', 't', 'ton', 'tons', 'bar', 'bars', 'cal', 'cals', 'pt', 'pts',
    'st', 'ct', 'mil', 'mils', 'hand', 'hands', 'rod', 'rods', 'chain', 'chains',
    '#', 'perch', 'thou', 'league', 'leagues', 'mach', 'pa'
  ]);

  /**
   * Words that, following an ambiguous single-letter token, mean it wasn't a
   * unit at all ("a 5m round", "12 g of RAM" is fine but "5 m users" is not).
   */
  const NOT_UNIT_AFTER = new Set([
    'users', 'user', 'people', 'views', 'view', 'subscribers', 'followers',
    'downloads', 'deal', 'deals', 'round', 'funding', 'revenue', 'valuation',
    'raised', 'investment', 'contract', 'salary', 'copies', 'units', 'votes',
    'shares', 'customers', 'players', 'records', 'streams', 'impressions'
  ]);

  /**
   * Words that confirm an ambiguous token really was a unit.
   * "36 in wide" is a measurement; "3 in stock" is not.
   */
  const DIMENSION_WORDS = new Set([
    'wide', 'wider', 'width', 'tall', 'taller', 'height', 'long', 'longer',
    'length', 'deep', 'deeper', 'depth', 'high', 'higher', 'thick', 'thicker',
    'thickness', 'across', 'diameter', 'diam', 'radius', 'apart', 'square',
    'tall,', 'wide,', 'long,', 'thick,', 'od', 'id'
  ]);

  const AMBIGUOUS_SHORT = new Set(['m', 'l', 'g', 'k', 'c', 'f', 't', 'w', 'j']);

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** All matchable tokens, longest first so "sq ft" beats "ft". */
  function collectTokens() {
    const ci = new Set();
    const cs = new Set();
    for (const unit of UL.UNITS) {
      for (const n of unit.names) ci.add(n);
      for (const n of unit.cs) cs.add(n);
    }
    const all = [...ci, ...cs].sort((a, b) => b.length - a.length);
    return { all, cs };
  }

  const TOKENS = collectTokens();

  // Degree-prefixed temperature forms are handled by including "°c"/"°f" tokens
  // plus an optional standalone degree sign in front of the letter.
  const TOKEN_ALT = TOKENS.all.map(escapeRe).join('|');

  /** Resolve a raw matched token back to a unit record. */
  function resolveToken(raw) {
    let t = raw.trim().replace(/\.$/, '');
    if (t in UL.BY_TOKEN_CS) return UL.BY_TOKEN_CS[t];
    const lower = t.toLowerCase().replace(/\s+/g, ' ');
    if (lower in UL.BY_TOKEN) return UL.BY_TOKEN[lower];
    // normalise "sq.ft" -> "sq ft", "fl.oz" -> "fl oz"
    const loose = lower.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
    return UL.BY_TOKEN[loose] || null;
  }

  UL.parseNumber = parseNumber;
  UL.resolveToken = resolveToken;
  UL._NUMBER = NUMBER;
  UL._TOKEN_ALT = TOKEN_ALT;
  UL._STRICT = STRICT;
  UL._NOT_UNIT_AFTER = NOT_UNIT_AFTER;
  UL._AMBIGUOUS_SHORT = AMBIGUOUS_SHORT;

  /* -------------------------------------------------------------- patterns */

  const SIGNED = String.raw`(?:[-−]\s?)?${NUMBER}`;
  const FT = String.raw`(?:'|′|ft\.?|feet|foot)`;
  const IN = String.raw`(?:"|″|''|in\.?|ins\.?|inch|inches)`;
  const LB = String.raw`(?:lb\.?|lbs\.?|pound|pounds)`;
  const OZ = String.raw`(?:oz\.?|ounce|ounces)`;
  const ST = String.raw`(?:st\.?|stone|stones)`;
  const X = String.raw`[x×✕*]`;
  const T = String.raw`(?:${TOKEN_ALT})`;

  const RE = {
    // 5'11"  |  5 ft 11 in  |  6 feet 2
    feetInches: new RegExp(String.raw`(${NUMBER})\s*${FT}\s*(${NUMBER})\s*${IN}?`, 'gi'),
    // 11 st 4 lb
    stoneLb: new RegExp(String.raw`(${NUMBER})\s*${ST}\s*(${NUMBER})\s*${LB}?`, 'gi'),
    // 6 lb 4 oz
    lbOz: new RegExp(String.raw`(${NUMBER})\s*${LB}\s*(${NUMBER})\s*${OZ}`, 'gi'),
    // 12 x 8 in  |  12in x 8in x 2in
    dimension: new RegExp(
      String.raw`${NUMBER}\s*(?:${T})?(?:\s*${X}\s*${NUMBER}\s*(?:${T})?)+`,
      'g'
    ),
    // 5-10 km  |  5 to 10 miles
    range: new RegExp(
      String.raw`(${NUMBER})\s*(?:-|–|—|\bto\b)\s*(${NUMBER})\s*(°\s*)?(${T})`,
      'gi'
    ),
    // 5 km  |  -4°C  |  3½ cups
    single: new RegExp(String.raw`(${SIGNED})\s*(°\s*)?(${T})`, 'gi'),
    // pairs inside a dimension span
    dimPair: new RegExp(String.raw`(${NUMBER})\s*(${T})?`, 'gi')
  };

  /* ---------------------------------------------------------------- guards */

  const CURRENCY = /[$€£¥₪₹¢₽₩]/;

  function charBefore(text, i) {
    return i > 0 ? text[i - 1] : '';
  }

  /** Reject matches that are clearly not measurements. */
  function contextOk(text, start, end, tokenRaw, unit, kind, hasDegree, gap) {
    const before = charBefore(text, start);
    const after = text.slice(end, end + 12);

    // money, or glued to a preceding word/number ("AB12mm", "v1.2mm")
    if (CURRENCY.test(before)) return false;
    if (/[A-Za-z0-9]/.test(before)) return false;
    if (/[\\/]/.test(before)) return false;

    // glued to a following word ("5 minutes" must not match "5 m")
    const endsWithPeriod = /\.$/.test(tokenRaw);
    if (!endsWithPeriod && /^[A-Za-z0-9]/.test(after)) return false;
    // unit immediately followed by another unit-ish slash ("km/h" handled as token)
    if (/^\s*\/\s*[A-Za-z]/.test(after)) return false;

    const token = tokenRaw.trim().replace(/\.$/, '');
    const lower = token.toLowerCase();

    // "5 m users" / "12 g round" -> not a measurement
    if (AMBIGUOUS_SHORT.has(lower)) {
      const nextWord = (after.match(/^\s*([A-Za-z]+)/) || [])[1];
      if (nextWord && NOT_UNIT_AFTER.has(nextWord.toLowerCase())) return false;
    }

    // bare K is almost always "thousand"
    if (token === 'K') return false;

    // bare C / F need a degree sign or to be glued to the digits
    if (unit.cat === 'temperature' && /^[CF]$/.test(token) && !hasDegree && gap) {
      return false;
    }

    // English words masquerading as units need strong context
    if (STRICT.has(lower)) {
      const strongKind = kind === 'compound' || kind === 'dimension';
      const quoted = /^["″']/.test(token);
      const nextWord = (after.match(/^\s*([A-Za-z,]+)/) || [])[1];
      const dimensional = nextWord && DIMENSION_WORDS.has(nextWord.toLowerCase());
      if (!strongKind && !quoted && !endsWithPeriod && !dimensional) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------ find spans */

  function push(out, m) {
    if (m) out.push(m);
  }

  function compound(text, re, kind, bigId, smallId, sum) {
    const out = [];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const big = UL.BY_ID[bigId];
      const small = UL.BY_ID[smallId];
      const a = parseNumber(m[1]);
      const b = parseNumber(m[2]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (b >= sum) continue; // 5 ft 20 in is not a height
      if (!contextOk(text, m.index, m.index + m[0].length, '', big, 'compound', false, false)) continue;
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        kind: 'compound',
        parts: [{ unit: big, value: a }, { unit: small, value: b }]
      });
    }
    return out;
  }

  UL.findMatches = function (text, opts) {
    const options = opts || {};
    const found = [];

    // 1. compounds (highest precedence — they span the most text)
    found.push(...compound(text, RE.feetInches, 'compound', 'ft', 'in', 12));
    found.push(...compound(text, RE.stoneLb, 'compound', 'st', 'lb', 14));
    found.push(...compound(text, RE.lbOz, 'compound', 'lb', 'oz', 16));

    // 2. dimension chains
    RE.dimension.lastIndex = 0;
    let dm;
    while ((dm = RE.dimension.exec(text))) {
      const span = dm[0];
      const pairs = [];
      RE.dimPair.lastIndex = 0;
      let pm;
      let lastUnit = null;
      while ((pm = RE.dimPair.exec(span))) {
        if (!pm[1]) continue;
        const unit = pm[2] ? resolveToken(pm[2]) : null;
        if (pm[2] && !unit) { pairs.length = 0; break; }
        if (unit) lastUnit = unit;
        pairs.push({ unit, value: parseNumber(pm[1]), raw: pm[2] || '' });
      }
      if (!pairs.length || !lastUnit) continue;
      if (pairs.some((p) => p.unit && p.unit.cat !== lastUnit.cat)) continue;
      const tokenRaw = pairs.find((p) => p.raw)?.raw || '';
      if (!contextOk(text, dm.index, dm.index + span.length, tokenRaw, lastUnit, 'dimension', false, false)) continue;
      for (const p of pairs) if (!p.unit) p.unit = lastUnit;
      push(found, {
        start: dm.index,
        end: dm.index + span.length,
        text: span,
        kind: 'dimension',
        parts: pairs.map((p) => ({ unit: p.unit, value: p.value }))
      });
    }

    // 3. ranges
    RE.range.lastIndex = 0;
    let rm;
    while ((rm = RE.range.exec(text))) {
      const unit = resolveToken(rm[4]);
      if (!unit) continue;
      const end = rm.index + rm[0].length;
      if (!contextOk(text, rm.index, end, rm[4], unit, 'range', !!rm[3], true)) continue;
      push(found, {
        start: rm.index,
        end,
        text: rm[0],
        kind: 'range',
        parts: [
          { unit, value: parseNumber(rm[1]) },
          { unit, value: parseNumber(rm[2]) }
        ]
      });
    }

    // 4. plain "<number> <unit>"
    RE.single.lastIndex = 0;
    let sm;
    while ((sm = RE.single.exec(text))) {
      const unit = resolveToken(sm[3]);
      if (!unit) continue;
      const end = sm.index + sm[0].length;
      const gap = /\s$/.test(sm[1]) || /\s/.test(sm[0].slice(sm[1].length, sm[0].length - sm[3].length));
      if (!contextOk(text, sm.index, end, sm[3], unit, 'single', !!sm[2], gap)) continue;
      let value = parseNumber(sm[1].replace(/^[-−]\s?/, ''));
      if (/^[-−]/.test(sm[1].trim())) value = -value;
      push(found, {
        start: sm.index,
        end,
        text: sm[0],
        kind: 'single',
        parts: [{ unit, value }]
      });
    }

    // 5. resolve overlaps: earliest start wins, then the longest span
    found.sort((a, b) => a.start - b.start || b.end - a.end);
    const result = [];
    let cursor = -1;
    for (const m of found) {
      if (m.start < cursor) continue;
      if (!m.parts.every((p) => Number.isFinite(p.value))) continue;
      if (options.filter && !options.filter(m)) continue;
      result.push(m);
      cursor = m.end;
    }
    return result;
  };
})();

