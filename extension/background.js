const API_BASE = 'https://api.github.com';
const DEBOUNCE_MS = 3000;
let debounceTimer;
let syncPromise;

function scheduleSync() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSync(), DEBOUNCE_MS);
}

chrome.tabs.onCreated.addListener(scheduleSync);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.groupId !== undefined || changeInfo.status === 'complete') {
    scheduleSync();
  }
});
chrome.tabs.onRemoved.addListener(scheduleSync);
chrome.tabs.onMoved.addListener(scheduleSync);
chrome.tabGroups.onUpdated.addListener(scheduleSync);
chrome.tabGroups.onRemoved.addListener(scheduleSync);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'syncNow') {
    runSync().then(sendResponse);
    return true;
  }
});

async function runSync() {
  // Reuse the active job so a second sync cannot overlap it.
  if (syncPromise) return syncPromise;
  syncPromise = performSync(true).finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}

async function performSync(allowRetry) {
  let result;
  try {
    result = await syncOnce();
  } catch (error) {
    result = { ok: false, message: error.message || 'Sync failed.' };
  }

  await chrome.storage.local.set({
    lastSync: { time: new Date().toISOString(), ok: result.ok, message: result.message }
  });

  if (allowRetry && result.retry) {
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));
    return performSync(false);
  }

  return { ok: result.ok, message: result.message };
}

async function syncOnce() {
  const { token, username, repo } = await chrome.storage.local.get(['token', 'username', 'repo']);
  if (!token || !username || !repo) {
    return { ok: false, message: 'Save your GitHub token, username, and repository first.' };
  }

  const groups = await collectNamedGroups();
  if (Object.keys(groups).length === 0) {
    return { ok: true, message: 'Skipped: no named tab groups open' };
  }

  const path = `/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/contents/tabs.json`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const currentResponse = await fetch(`${API_BASE}${path}`, { headers });
  if (!currentResponse.ok) return responseFailure(currentResponse);

  const current = await currentResponse.json();
  let existing;
  try {
    // GitHub returns base64 content, which may contain line breaks.
    const decoded = decodeURIComponent(escape(atob(current.content.replace(/\s/g, ''))));
    existing = JSON.parse(decoded);
  } catch {
    return { ok: false, message: 'The existing tabs.json is not valid JSON.' };
  }

  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    return { ok: false, message: 'The existing tabs.json must be a JSON object.' };
  }

  // Keep groups that are not currently open and replace active ones.
  const merged = Object.assign(Object.create(null), existing);
  for (const [name, urls] of Object.entries(groups)) merged[name] = urls;

  if (JSON.stringify(merged) === JSON.stringify(existing)) {
    return { ok: true, message: 'No changes to sync.' };
  }

  const jsonString = `${JSON.stringify(merged, null, 2)}\n`;
  const content = btoa(unescape(encodeURIComponent(jsonString)));
  const updateResponse = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/vnd.github+json' },
    body: JSON.stringify({
      message: 'Sync named Chrome tab groups',
      sha: current.sha,
      content
    })
  });

  if (!updateResponse.ok) return responseFailure(updateResponse);
  return { ok: true, message: 'Tab groups synced to GitHub.' };
}

async function collectNamedGroups() {
  const [tabGroups, tabs] = await Promise.all([
    chrome.tabGroups.query({}),
    chrome.tabs.query({})
  ]);
  const namesById = new Map();
  for (const group of tabGroups) {
    const name = group.title.trim().toLowerCase();
    if (name) namesById.set(group.id, name);
  }

  const results = Object.create(null);
  // tabs.query returns tab order; keep matching URLs in that order.
  tabs.sort((a, b) => a.windowId - b.windowId || a.index - b.index);
  for (const tab of tabs) {
    const name = namesById.get(tab.groupId);
    if (!name) continue;
    if (!Object.hasOwn(results, name)) results[name] = [];
    if (tab.url && /^https?:\/\//i.test(tab.url)) results[name].push(tab.url);
  }
  return results;
}

async function responseFailure(response) {
  let detail = '';
  try {
    detail = (await response.json()).message || '';
  } catch {
    // Keep the useful HTTP status even if GitHub returned no JSON.
  }
  return {
    ok: false,
    retry: response.status === 409 || response.status === 422,
    message: `GitHub error ${response.status}${detail ? `: ${detail}` : ''}`
  };
}
