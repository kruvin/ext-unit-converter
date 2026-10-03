/**
 * Unit Lens — content script.
 * Scans text nodes, annotates foreign measurements, shows a hover tooltip.
 */
(function () {
  'use strict';

  const UL = self.UL;
  if (!UL || !UL.findMatches) return;
  if (self.__unitLensLoaded) return;
  self.__unitLensLoaded = true;

  const MARK = 'ul-measure';
  const MAX_MARKS = 4000;
  const MAX_TEXT_LEN = 6000;

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
    'CODE', 'KBD', 'SAMP', 'TITLE', 'SVG', 'MATH', 'IFRAME', 'OBJECT',
    'CANVAS', 'VIDEO', 'AUDIO', 'TEMPLATE'
  ]);

  let settings = UL.defaultSettings();
  let markCount = 0;
  let tooltip = null;
  let hideTimer = null;
  let activeMark = null;

  /* ---------------------------------------------------------------- startup */

  chrome.storage.sync.get(null, (stored) => {
    settings = Object.assign(UL.defaultSettings(), stored || {});
    if (!settings.map) settings.map = UL.PRESETS[settings.system].map;
    if (!settings.enabled || isBlocked()) return;
    start();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const next = Object.assign({}, settings);
    for (const [k, v] of Object.entries(changes)) next[k] = v.newValue;
    settings = next;
    rescanAll();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg && msg.type === 'ul:count') {
      respond({ count: document.querySelectorAll(`.${MARK}`).length });
      return true;
    }
    if (msg && msg.type === 'ul:rescan') {
      rescanAll();
      respond({ ok: true });
      return true;
    }
    return false;
  });

  function isBlocked() {
    const host = location.hostname.replace(/^www\./, '');
    const list = (settings.blocklist || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const hit = list.some((d) => host === d || host.endsWith('.' + d));
    return settings.siteMode === 'allowlist' ? !hit : hit;
  }

  function start() {
    scan(document.body || document.documentElement);
    observe();
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', hideSoon, { passive: true, capture: true });
  }

  function rescanAll() {
    unmarkAll();
    markCount = 0;
    if (!settings.enabled || isBlocked()) return;
    scan(document.body || document.documentElement);
  }

  function unmarkAll() {
    for (const el of [...document.querySelectorAll(`.${MARK}`)]) {
      const text = document.createTextNode(el.getAttribute('data-ul-raw') || el.textContent);
      el.parentNode && el.parentNode.replaceChild(text, el);
    }
    document.querySelectorAll('[data-ul-done]').forEach((n) => n.removeAttribute('data-ul-done'));
  }

  /* ------------------------------------------------------------- DOM walking */

  function shouldSkipElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.classList && el.classList.contains(MARK)) return true;
    if (el.id === 'ul-tooltip') return true;
    if (el.isContentEditable) return true;
    if (el.closest && el.closest('[data-ul-skip]')) return true;
    return false;
  }

  function collectTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const value = node.nodeValue;
        if (!value || value.length > MAX_TEXT_LEN) return NodeFilter.FILTER_REJECT;
        if (!/\d|[½⅓⅔¼¾⅛⅜⅝⅞]/.test(value)) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
        for (let el = parent; el && el !== root; el = el.parentElement) {
          if (shouldSkipElement(el)) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  /** Walk open shadow roots too — lots of sites render content there now. */
  function collectRoots(root, out) {
    out.push(root);
    const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const el of all) {
      if (el.shadowRoot) collectRoots(el.shadowRoot, out);
    }
    return out;
  }

  function scan(root) {
    if (!root) return;
    const roots = collectRoots(root, []);
    const nodes = [];
    for (const r of roots) nodes.push(...collectTextNodes(r));
    processInChunks(nodes);
  }

  /** Hoisted on purpose: scanning can begin before this point is evaluated. */
  function schedule(fn) {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 500 });
    else setTimeout(fn, 0);
  }

  function processInChunks(nodes) {
    let i = 0;
    const step = () => {
      const deadline = performance.now() + 12;
      while (i < nodes.length && performance.now() < deadline) {
        if (markCount < MAX_MARKS) processTextNode(nodes[i]);
        i++;
      }
      if (i < nodes.length) schedule(step);
    };
    schedule(step);
  }

  /* ------------------------------------------------------------- annotating */

  function processTextNode(node) {
    if (!node.parentNode || !node.nodeValue) return;
    const text = node.nodeValue;

    const matches = UL.findMatches(text, {
      filter: (m) => {
        const cat = m.parts[0].unit.cat;
        if (settings.categories && settings.categories[cat] === false) return false;
        const system = UL.targetSystemFor(settings, cat);
        return m.parts.some((p) => UL.isForeign(p.unit, system));
      }
    });
    if (!matches.length) return;

    const results = [];
    for (const m of matches) {
      const conv = UL.convertMatch(m, settings);
      if (conv) results.push({ m, conv });
    }
    if (!results.length) return;

    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const { m, conv } of results) {
      if (m.start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
      frag.appendChild(buildMark(text.slice(m.start, m.end), conv));
      cursor = m.end;
      markCount++;
    }
    if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
    node.parentNode.replaceChild(frag, node);
  }

  function buildMark(raw, conv) {
    const span = document.createElement('span');
    span.className = `${MARK} ul-u-${settings.underline || 'dotted'}`;
    span.setAttribute('data-ul-raw', raw);
    span.setAttribute('data-ul-label', conv.label);
    span.setAttribute('data-ul-cat', conv.category);
    span.setAttribute('data-ul-from', conv.sourceUnit.symbol);
    span.setAttribute('tabindex', '0');
    span.setAttribute('role', 'button');
    span.setAttribute('aria-label', `${raw.trim()} is about ${conv.label}`);
    span.textContent = raw;

    if (settings.trigger === 'inline') {
      const extra = document.createElement('span');
      extra.className = 'ul-inline';
      extra.textContent = ` (≈${conv.label})`;
      span.appendChild(extra);
    }
    return span;
  }

  /* ---------------------------------------------------------------- tooltip */

  function ensureTooltip() {
    if (tooltip && tooltip.isConnected) return tooltip;
    tooltip = document.createElement('div');
    tooltip.id = 'ul-tooltip';
    tooltip.setAttribute('data-ul-skip', '');
    tooltip.setAttribute('role', 'tooltip');
    tooltip.innerHTML =
      '<div class="ul-tt-main"></div><div class="ul-tt-sub"></div><div class="ul-tt-hint">click to copy</div>';
    (document.body || document.documentElement).appendChild(tooltip);
    tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    tooltip.addEventListener('mouseleave', hideSoon);
    return tooltip;
  }

  function showTooltip(mark) {
    if (settings.trigger === 'inline') return;
    const tt = ensureTooltip();
    clearTimeout(hideTimer);
    activeMark = mark;
    tt.querySelector('.ul-tt-main').textContent = '≈ ' + mark.getAttribute('data-ul-label');
    tt.querySelector('.ul-tt-sub').textContent = settings.showOriginal
      ? `${mark.getAttribute('data-ul-raw').trim()} · ${UL.CATEGORIES[mark.getAttribute('data-ul-cat')].label.toLowerCase()}`
      : '';
    tt.classList.add('ul-visible');
    position(tt, mark);
  }

  function position(tt, mark) {
    const r = mark.getBoundingClientRect();
    tt.style.visibility = 'hidden';
    tt.style.left = '0px';
    tt.style.top = '0px';
    const tr = tt.getBoundingClientRect();
    const gap = 8;
    let left = r.left + r.width / 2 - tr.width / 2;
    let top = r.top - tr.height - gap;
    let flipped = false;
    if (top < 4) {
      top = r.bottom + gap;
      flipped = true;
    }
    left = Math.max(6, Math.min(left, window.innerWidth - tr.width - 6));
    tt.classList.toggle('ul-below', flipped);
    tt.style.left = `${Math.round(left)}px`;
    tt.style.top = `${Math.round(top)}px`;
    tt.style.visibility = 'visible';
  }

  function hideSoon() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (tooltip) tooltip.classList.remove('ul-visible');
      activeMark = null;
    }, 120);
  }

  function markFrom(target) {
    if (!target || target.nodeType !== 1) return null;
    return target.closest ? target.closest(`.${MARK}`) : null;
  }

  function onMouseOver(e) {
    const mark = markFrom(e.target);
    if (!mark) return;
    if (settings.trigger === 'click') return;
    showTooltip(mark);
  }

  function onMouseOut(e) {
    if (markFrom(e.target)) hideSoon();
  }

  function onClick(e) {
    const mark = markFrom(e.target);
    if (!mark) return;
    if (settings.trigger === 'click' && activeMark !== mark) {
      showTooltip(mark);
      e.preventDefault();
      return;
    }
    const label = mark.getAttribute('data-ul-label');
    navigator.clipboard && navigator.clipboard.writeText(label).then(() => {
      const tt = ensureTooltip();
      const hint = tt.querySelector('.ul-tt-hint');
      hint.textContent = 'copied!';
      setTimeout(() => (hint.textContent = 'click to copy'), 1200);
    }).catch(() => {});
  }

  document.addEventListener('focusin', (e) => {
    const mark = markFrom(e.target);
    if (mark) showTooltip(mark);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideSoon();
  });

  /* -------------------------------------------------------------- observing */

  function observe() {
    let pending = new Set();
    let timer = null;
    const flush = () => {
      timer = null;
      const roots = [...pending];
      pending = new Set();
      for (const r of roots) {
        if (r.isConnected) scan(r);
      }
    };
    const mo = new MutationObserver((records) => {
      for (const rec of records) {
        if (rec.type === 'childList') {
          for (const n of rec.addedNodes) {
            if (n.nodeType === 1 && !shouldSkipElement(n)) pending.add(n);
            else if (n.nodeType === 3 && n.parentElement && !shouldSkipElement(n.parentElement)) {
              pending.add(n.parentElement);
            }
          }
        } else if (rec.type === 'characterData' && rec.target.parentElement) {
          pending.add(rec.target.parentElement);
        }
      }
      if (pending.size && !timer) timer = setTimeout(flush, 300);
    });
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
})();
