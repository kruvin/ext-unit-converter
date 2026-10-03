/**
 * Unit Lens — conversion engine.
 * Turns a detected match + user settings into a display string, or null when
 * the measurement is already in units the user knows.
 */
(function () {
  'use strict';

  const UL = (self.UL = self.UL || {});

  const NBSP = '\u202f'; // narrow no-break space between value and unit

  /* ------------------------------------------------------------- formatting */

  /** Round to a sensible number of decimals for the magnitude. */
  function autoDecimals(v) {
    const a = Math.abs(v);
    if (a === 0) return 0;
    if (a >= 1000) return 0;
    if (a >= 10) return 1;
    if (a >= 1) return 2;
    if (a >= 0.1) return 2;
    if (a >= 0.01) return 3;
    return 4;
  }

  function formatNumber(v, precision) {
    if (!Number.isFinite(v)) return '—';
    const d = precision === 'auto' || precision == null ? autoDecimals(v) : Number(precision);
    let s = v.toFixed(Math.min(d, 6));
    if (s.includes('.')) s = s.replace(/\.?0+$/, '');
    const n = Number(s);
    // thousands separators for readability
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(d, 6)
    });
  }

  UL.formatNumber = formatNumber;

  /* --------------------------------------------------------- target picking */

  /** Choose the output unit for a base-unit magnitude. */
  function pickTarget(sourceUnit, base, system) {
    const preferred = UL.PREFERRED[sourceUnit.id];
    if (preferred && preferred[system] && UL.BY_ID[preferred[system]]) {
      return UL.BY_ID[preferred[system]];
    }
    const sourceLadder = (UL.SOURCE_LADDERS[sourceUnit.id] || {})[system];
    const ladder = sourceLadder || (UL.LADDERS[sourceUnit.cat] || {})[system];
    if (!ladder) return null;
    const mag = Math.abs(base);
    for (const [id, bound] of ladder) {
      if (mag < bound) return UL.BY_ID[id];
    }
    return UL.BY_ID[ladder[ladder.length - 1][0]];
  }

  /**
   * Render one converted value, optionally as a two-part compound
   * (5 ft 11 in / 11 st 4 lb) which is how people actually say them.
   */
  function renderValue(targetUnit, base, settings) {
    const precision = settings.precision;
    const compound = settings.compoundOutput !== false;
    const value = UL.fromBase(targetUnit, base);

    if (compound && targetUnit.id === 'ft' && Math.abs(value) < 100) {
      const ft = Math.floor(Math.abs(value));
      const inches = (Math.abs(value) - ft) * 12;
      const inRounded = Math.round(inches);
      const carry = inRounded === 12;
      const ftFinal = (ft + (carry ? 1 : 0)) * Math.sign(value || 1);
      const inFinal = carry ? 0 : inRounded;
      if (ft >= 1 && inFinal > 0) return `${ftFinal}${NBSP}ft ${inFinal}${NBSP}in`;
      if (ft >= 1) return `${ftFinal}${NBSP}ft`;
    }

    if (compound && targetUnit.id === 'st') {
      const st = Math.floor(value);
      const lb = Math.round((value - st) * 14);
      const carry = lb === 14;
      if (st >= 1) {
        return `${st + (carry ? 1 : 0)}${NBSP}st${carry || lb === 0 ? '' : ` ${lb}${NBSP}lb`}`;
      }
    }

    return `${formatNumber(value, precision)}${NBSP}${targetUnit.symbol}`;
  }

  /* ------------------------------------------------------------- public API */

  UL.defaultSettings = function () {
    return {
      enabled: true,
      system: 'metric',
      map: Object.assign({}, UL.PRESETS.metric.map),
      categories: Object.keys(UL.CATEGORIES).reduce((a, c) => ((a[c] = true), a), {}),
      precision: 'auto',
      compoundOutput: true,
      underline: 'dotted',
      trigger: 'hover',
      showOriginal: true,
      siteMode: 'all',
      blocklist: []
    };
  };

  /** The system the user wants results in for a given category. */
  UL.targetSystemFor = function (settings, cat) {
    const map = settings.map || UL.PRESETS[settings.system || 'metric'].map;
    return map[cat] || settings.system || 'metric';
  };

  /**
   * @returns {null | { label, original, category, targetUnit, sourceUnit, exact }}
   */
  UL.convertMatch = function (match, settings) {
    const parts = match.parts;
    const cat = parts[0].unit.cat;
    if (settings.categories && settings.categories[cat] === false) return null;
    if (parts.some((p) => p.unit.cat !== cat)) return null;

    const system = UL.targetSystemFor(settings, cat);

    // Compounds like 5 ft 11 in are a single measurement expressed in two units.
    if (match.kind === 'compound') {
      const base = parts.reduce((sum, p) => sum + UL.toBase(p.unit, p.value), 0);
      if (!UL.isForeign(parts[0].unit, system)) return null;
      const target = pickTarget(parts[0].unit, base, system);
      if (!target || target.cat !== cat) return null;
      if (target.id === parts[0].unit.id) return null;
      return {
        label: renderValue(target, base, settings),
        original: match.text.trim(),
        category: cat,
        sourceUnit: parts[0].unit,
        targetUnit: target
      };
    }

    // Every part must be foreign, otherwise leave it alone.
    if (!parts.some((p) => UL.isForeign(p.unit, system))) return null;

    const bases = parts.map((p) => UL.toBase(p.unit, p.value));
    const biggest = bases.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), bases[0]);
    const target = pickTarget(parts[0].unit, biggest, system);
    if (!target || target.cat !== cat) return null;
    if (target.id === parts[0].unit.id) return null;

    const rendered = bases.map((b) => renderValue(target, b, settings));
    let label;
    if (match.kind === 'range') {
      const a = rendered[0].replace(new RegExp(`${NBSP}${escapeRe(target.symbol)}$`), '');
      label = `${a}–${rendered[1]}`;
    } else if (match.kind === 'dimension') {
      const stripped = rendered.map((r, i) =>
        i === rendered.length - 1 ? r : r.replace(new RegExp(`${NBSP}${escapeRe(target.symbol)}$`), '')
      );
      label = stripped.join(' × ');
    } else {
      label = rendered[0];
    }

    return {
      label,
      original: match.text.trim(),
      category: cat,
      sourceUnit: parts[0].unit,
      targetUnit: target
    };
  };

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
})();
