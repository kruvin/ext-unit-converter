/** Unit Lens — service worker: first-run defaults and badge upkeep. */

const DEFAULTS = {
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

chrome.runtime.onInstalled.addListener(async (details) => {
  const stored = await chrome.storage.sync.get(null);
  const patch = {};
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (!(k in stored)) patch[k] = v;
  }
  if (Object.keys(patch).length) await chrome.storage.sync.set(patch);
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

async function paintBadge(enabled) {
  await chrome.action.setBadgeText({ text: enabled ? '' : 'off' });
  await chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.enabled) paintBadge(changes.enabled.newValue);
});

chrome.runtime.onStartup.addListener(async () => {
  const { enabled = true } = await chrome.storage.sync.get('enabled');
  paintBadge(enabled);
});
