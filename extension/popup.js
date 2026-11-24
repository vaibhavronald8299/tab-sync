const fields = ['token', 'username', 'repo'];
const statusLine = document.querySelector('#status');

function valuesFromForm() {
  return Object.fromEntries(fields.map((field) => [field, document.querySelector(`#${field}`).value.trim()]));
}

async function saveFields() {
  await chrome.storage.local.set(valuesFromForm());
}

function showStatus(lastSync) {
  if (!lastSync) {
    statusLine.textContent = 'No sync yet.';
    statusLine.classList.remove('failed');
    return;
  }
  const time = new Date(lastSync.time).toLocaleString();
  statusLine.textContent = `${time} — ${lastSync.message}`;
  statusLine.classList.toggle('failed', !lastSync.ok);
}

chrome.storage.local.get([...fields, 'lastSync']).then((saved) => {
  for (const field of fields) {
    if (saved[field]) document.querySelector(`#${field}`).value = saved[field];
  }
  showStatus(saved.lastSync);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.lastSync) showStatus(changes.lastSync.newValue);
});

document.querySelector('#save').addEventListener('click', async () => {
  await saveFields();
  statusLine.textContent = 'Settings saved.';
  statusLine.classList.remove('failed');
});

document.querySelector('#sync').addEventListener('click', async () => {
  await saveFields();
  statusLine.textContent = 'Syncing…';
  statusLine.classList.remove('failed');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'syncNow' });
    if (result) showStatus({ ...result, time: new Date().toISOString() });
  } catch {
    statusLine.textContent = 'Could not contact the background sync service.';
    statusLine.classList.add('failed');
  }
});
