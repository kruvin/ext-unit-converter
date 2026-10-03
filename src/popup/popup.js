/** Unit Lens — popup controller. */
(function () {
  'use strict';

  const UL = self.UL;
  const $ = (id) => document.getElementById(id);
  let settings = UL.defaultSettings();
  let host = '';

  async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function siteBlocked() {
    const list = (settings.blocklist || []).map((s) => s.toLowerCase());
    const hit = list.some((d) => host === d || host.endsWith('.' + d));
    return settings.siteMode === 'allowlist' ? !hit : hit;
  }

  function render() {
    $('enabled').checked = !!settings.enabled;
    $('system').value = settings.system || 'metric';
    const preset = UL.PRESETS[settings.system] || UL.PRESETS.metric;
    $('systemHint').textContent = preset.hint;

    for (const b of document.querySelectorAll('#trigger button')) {
      b.setAttribute('aria-pressed', String(b.dataset.v === (settings.trigger || 'hover')));
    }

    const blocked = siteBlocked();
    $('toggleSite').textContent = blocked ? `Enable on ${host}` : `Disable on ${host}`;
    $('toggleSite').disabled = !host;
  }

  async function save(patch) {
    settings = Object.assign(settings, patch);
    await chrome.storage.sync.set(patch);
    render();
  }

  async function refreshCount() {
    const tab = await activeTab();
    if (!tab || !tab.id) return;
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'ul:count' });
      $('count').textContent = res && typeof res.count === 'number' ? res.count : '0';
    } catch {
      $('count').textContent = '—';
    }
  }

  /* ----------------------------------------------------------------- events */

  $('enabled').addEventListener('change', (e) => save({ enabled: e.target.checked }));

  $('system').addEventListener('change', (e) => {
    const system = e.target.value;
    if (system === 'custom') {
      chrome.runtime.openOptionsPage();
      return;
    }
    save({ system, map: Object.assign({}, UL.PRESETS[system].map) });
  });

  for (const b of document.querySelectorAll('#trigger button')) {
    b.addEventListener('click', () => save({ trigger: b.dataset.v }));
  }

  $('rescan').addEventListener('click', async () => {
    const tab = await activeTab();
    if (!tab || !tab.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'ul:rescan' });
      setTimeout(refreshCount, 400);
    } catch {}
  });

  $('toggleSite').addEventListener('click', async () => {
    if (!host) return;
    const list = new Set(settings.blocklist || []);
    const blocked = siteBlocked();
    const inList = [...list].some((d) => host === d || host.endsWith('.' + d));
    if (settings.siteMode === 'allowlist') {
      blocked ? list.add(host) : list.delete(host);
    } else {
      inList ? list.delete(host) : list.add(host);
    }
    await save({ blocklist: [...list] });
    const tab = await activeTab();
    if (tab && tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'ul:rescan' });
      } catch {}
      setTimeout(refreshCount, 400);
    }
  });

  $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

  /* ------------------------------------------------------------------- init */

  (async () => {
    const stored = await chrome.storage.sync.get(null);
    settings = Object.assign(UL.defaultSettings(), stored || {});
    const tab = await activeTab();
    host = tab ? hostOf(tab.url || '') : '';
    render();
    refreshCount();
  })();
})();
