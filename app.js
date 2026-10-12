// Amanda's CRM. Everything runs in the browser; customer data is stored on
// this device only (IndexedDB) and is never sent anywhere.

const STAGES = ['New lead', 'Showing', 'Application', 'Approved', 'Deposit', 'Closing', 'Delivered', 'Lost'];

// The add/edit form and the customer page are generated from this list. To
// add, remove or rename a field, change it here.
const SECTIONS = [
  { title: 'Contact', fields: [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'email', label: 'Email', inputmode: 'email' },
    { key: 'address', label: 'Address' },
    { key: 'source', label: 'How they heard about you' },
    { key: 'firstContact', label: 'First contact', type: 'date' },
  ] },
  { title: 'What they want', fields: [
    { key: 'size', label: 'Bedrooms or size' },
    { key: 'budget', label: 'Budget range' },
    { key: 'condition', label: 'New or used', options: ['New', 'Used', 'Either'] },
    { key: 'placement', label: 'Land or community', options: ['Own land', 'Community', 'Undecided'] },
    { key: 'timeline', label: 'Timeline' },
  ] },
  { title: 'Financing', fields: [
    { key: 'payment', label: 'Cash or financed', options: ['Cash', 'Financed', 'Undecided'] },
    { key: 'lender', label: 'Lender' },
    { key: 'preapproval', label: 'Pre-approval status', options: ['Not started', 'Applied', 'Pre-approved', 'Denied'] },
  ] },
  { title: 'Deal', fields: [
    { key: 'stage', label: 'Stage', options: STAGES, required: true },
    { key: 'home', label: 'Home of interest' },
    { key: 'quotedPrice', label: 'Quoted price', inputmode: 'decimal' },
    { key: 'deposit', label: 'Deposit taken', inputmode: 'decimal' },
    { key: 'depositDate', label: 'Deposit date', type: 'date' },
    { key: 'closingDate', label: 'Closing date', type: 'date' },
    { key: 'deliveryDate', label: 'Delivery date', type: 'date' },
  ] },
  { title: 'Next step', fields: [
    { key: 'followUpDate', label: 'Follow up on', type: 'date' },
    { key: 'followUpAction', label: 'What to do', wide: true },
  ] },
];

const ALL_FIELDS = SECTIONS.flatMap((section) => section.fields);
const LAST_BACKUP_KEY = 'amanda-crm-last-backup';

const app = document.getElementById('app');
let db;
let customers = [];
let listFilter = { search: '', stage: '' };

// ---------- storage ----------

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('amanda-crm', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('customers', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function loadCustomers() {
  return new Promise((resolve, reject) => {
    const req = db.transaction('customers').objectStore('customers').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveCustomer(customer) {
  await new Promise((resolve, reject) => {
    const tx = db.transaction('customers', 'readwrite');
    tx.objectStore('customers').put(customer);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  customers = customers.filter((c) => c.id !== customer.id).concat(customer);
}

async function deleteCustomer(id) {
  await new Promise((resolve, reject) => {
    const tx = db.transaction('customers', 'readwrite');
    tx.objectStore('customers').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  customers = customers.filter((c) => c.id !== id);
}

// Replaces every customer in one transaction, so a failed restore changes nothing.
async function replaceAllCustomers(list) {
  await new Promise((resolve, reject) => {
    const tx = db.transaction('customers', 'readwrite');
    const store = tx.objectStore('customers');
    store.clear();
    list.forEach((c) => store.put(c));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  customers = list;
}

// ---------- helpers ----------

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}/${y}`;
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function digits(text) {
  return String(text || '').replace(/\D/g, '');
}

function displayValue(field, value) {
  return field.type === 'date' ? formatDate(value) : value;
}

function badge(stage) {
  return `<span class="badge" data-stage="${esc(stage)}">${esc(stage)}</span>`;
}

// ---------- customer list ----------

function matchesFilter(c) {
  if (listFilter.stage && c.stage !== listFilter.stage) return false;
  const q = listFilter.search.trim().toLowerCase();
  if (!q) return true;
  if ((c.name || '').toLowerCase().includes(q)) return true;
  const qDigits = digits(q);
  return qDigits !== '' && digits(c.phone).includes(qDigits);
}

function renderRows() {
  const shown = customers
    .filter(matchesFilter)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  document.getElementById('count').textContent =
    `${shown.length} of ${customers.length} customer${customers.length === 1 ? '' : 's'}`;

  const list = document.getElementById('rows');
  if (customers.length === 0) {
    list.innerHTML = '<li class="empty">No customers yet. Tap <strong>Add customer</strong> to create the first one.</li>';
    return;
  }
  if (shown.length === 0) {
    list.innerHTML = '<li class="empty">No customers match.</li>';
    return;
  }
  list.innerHTML = shown.map((c) => {
    const sub = [c.phone, c.home, c.followUpDate && `Follow up ${formatDate(c.followUpDate)}`]
      .filter(Boolean).map(esc).join(' &middot; ');
    return `
      <li><a class="row" href="#/customer/${esc(c.id)}">
        <span class="row-main">
          <span class="row-name">${esc(c.name)}</span>
          <div class="row-sub">${sub}</div>
        </span>
        ${badge(c.stage)}
      </a></li>`;
  }).join('');
}

function renderList() {
  app.innerHTML = `
    <div class="toolbar">
      <input class="search" id="search" type="search" placeholder="Search name or phone"
             aria-label="Search name or phone" value="${esc(listFilter.search)}">
      <select id="stage-filter" aria-label="Filter by stage">
        <option value="">All stages</option>
        ${STAGES.map((s) => `<option${s === listFilter.stage ? ' selected' : ''}>${esc(s)}</option>`).join('')}
      </select>
      <a class="btn btn-primary" href="#/new">Add customer</a>
    </div>
    <p class="count" id="count"></p>
    <ul class="list" id="rows"></ul>`;

  document.getElementById('search').addEventListener('input', (e) => {
    listFilter.search = e.target.value;
    renderRows();
  });
  document.getElementById('stage-filter').addEventListener('change', (e) => {
    listFilter.stage = e.target.value;
    renderRows();
  });
  renderRows();
}

// ---------- customer page with notes log ----------

function notesHtml(customer) {
  const notes = (customer.notes || []).slice().sort((a, b) => (
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  ));
  if (notes.length === 0) return '<p class="muted">No notes yet.</p>';
  return `<ul class="notes">${notes.map((n) => `
    <li><div class="note-date">${esc(formatDate(n.date))}</div><div class="note-text">${esc(n.text)}</div></li>`).join('')}</ul>`;
}

function renderDetail(customer) {
  const sections = SECTIONS.map((section) => {
    const rows = section.fields
      .filter((f) => f.key !== 'name' && f.key !== 'stage' && customer[f.key])
      .map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(displayValue(f, customer[f.key]))}</dd></div>`);
    if (rows.length === 0) return '';
    return `<section class="card"><h2>${esc(section.title)}</h2><dl>${rows.join('')}</dl></section>`;
  }).join('');

  app.innerHTML = `
    <a class="back" href="#/">&lsaquo; All customers</a>
    <div class="detail-head">
      <h1>${esc(customer.name)}</h1>
      ${badge(customer.stage)}
      <a class="btn" href="#/edit/${esc(customer.id)}">Edit</a>
    </div>
    ${sections}
    <section class="card">
      <h2>Notes</h2>
      <form id="note-form" class="note-form">
        <div class="field note-date-field">
          <label for="note-date">Date</label>
          <input id="note-date" type="date" value="${today()}">
        </div>
        <div class="field">
          <label for="note-text">New note</label>
          <textarea id="note-text" rows="3"></textarea>
        </div>
        <p class="error" id="note-error" role="alert" hidden></p>
        <div><button class="btn btn-primary" type="submit">Add note</button></div>
      </form>
      <div id="notes">${notesHtml(customer)}</div>
    </section>`;

  document.getElementById('note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const textBox = document.getElementById('note-text');
    const text = textBox.value.trim();
    if (!text) {
      textBox.focus();
      return;
    }
    const now = new Date().toISOString();
    const note = { id: newId(), date: document.getElementById('note-date').value || today(), text, createdAt: now };
    const updated = { ...customer, notes: (customer.notes || []).concat(note), updatedAt: now };
    const error = document.getElementById('note-error');
    try {
      await saveCustomer(updated);
    } catch (err) {
      error.textContent = 'Could not save the note. Please try again.';
      error.hidden = false;
      return;
    }
    renderDetail(updated);
  });
}

// ---------- add / edit form ----------

function fieldHtml(field, value) {
  const id = `f-${field.key}`;
  let control;
  if (field.options) {
    const blank = field.required ? '' : '<option value=""></option>';
    control = `<select id="${id}" name="${field.key}">${blank}${
      field.options.map((o) => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')
    }</select>`;
  } else {
    const inputmode = field.inputmode ? ` inputmode="${field.inputmode}"` : '';
    control = `<input id="${id}" name="${field.key}" type="${field.type || 'text'}"${inputmode}
                      autocomplete="off" value="${esc(value)}">`;
  }
  return `<div class="field${field.wide ? ' wide' : ''}"><label for="${id}">${esc(field.label)}</label>${control}</div>`;
}

function renderForm(existing) {
  const customer = existing || { stage: STAGES[0], firstContact: today() };
  const cancelHref = existing ? `#/customer/${esc(existing.id)}` : '#/';
  app.innerHTML = `
    <h1>${existing ? 'Edit customer' : 'Add customer'}</h1>
    <form id="customer-form" novalidate>
      ${SECTIONS.map((section) => `
        <fieldset>
          <legend>${esc(section.title)}</legend>
          <div class="fields">${section.fields.map((f) => fieldHtml(f, customer[f.key])).join('')}</div>
        </fieldset>`).join('')}
      <p class="error" id="form-error" role="alert" hidden></p>
      <div class="actions">
        <button class="btn btn-primary" type="submit">Save</button>
        <a class="btn" href="${cancelHref}">Cancel</a>
        ${existing ? '<button class="btn btn-danger" id="delete-btn" type="button">Delete customer</button>' : ''}
      </div>
    </form>`;

  if (existing) {
    document.getElementById('delete-btn').addEventListener('click', async () => {
      const noteCount = (existing.notes || []).length;
      const question = `Delete ${existing.name} and their ${noteCount} note${noteCount === 1 ? '' : 's'}? This cannot be undone.`;
      if (!confirm(question)) return;
      try {
        await deleteCustomer(existing.id);
      } catch (err) {
        const error = document.getElementById('form-error');
        error.textContent = 'Could not delete. Nothing was changed. Please try again.';
        error.hidden = false;
        return;
      }
      location.hash = '#/';
    });
  }

  document.getElementById('customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    for (const key of Object.keys(values)) values[key] = values[key].trim();

    const error = document.getElementById('form-error');
    if (!values.name) {
      error.textContent = 'Please enter a name.';
      error.hidden = false;
      document.getElementById('f-name').focus();
      return;
    }

    const now = new Date().toISOString();
    const saved = { ...customer, ...values, updatedAt: now };
    if (!existing) {
      saved.id = newId();
      saved.createdAt = now;
    }
    try {
      await saveCustomer(saved);
    } catch (err) {
      error.textContent = 'Could not save. Nothing was changed. Please try again.';
      error.hidden = false;
      return;
    }
    location.hash = `#/customer/${saved.id}`;
  });
}

// ---------- follow-ups ----------

function renderFollowUps() {
  const now = today();
  const due = customers
    .filter((c) => c.followUpDate)
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate) || (a.name || '').localeCompare(b.name || ''));

  const rows = due.map((c) => {
    const overdue = c.followUpDate < now;
    const label = c.followUpDate === now ? 'Today' : formatDate(c.followUpDate);
    return `
      <li><a class="row" href="#/customer/${esc(c.id)}">
        <span class="due${overdue ? ' overdue' : ''}">${esc(label)}${overdue ? '<br><small>Overdue</small>' : ''}</span>
        <span class="row-main">
          <span class="row-name">${esc(c.name)}</span>
          <div class="row-sub">${[c.followUpAction, c.phone].filter(Boolean).map(esc).join(' &middot; ')}</div>
        </span>
        ${badge(c.stage)}
      </a></li>`;
  }).join('');

  app.innerHTML = `
    <h1>Follow-ups</h1>
    <p class="count">Customers with a follow-up date, earliest first. To take someone off this list, edit them and clear the date.</p>
    <ul class="list">${rows || '<li class="empty">No follow-ups are set.</li>'}</ul>`;
}

// ---------- backup, restore and spreadsheet export ----------

// On an iPad this opens the share sheet (choose "Save to Files"); elsewhere
// it downloads the file. Returns false if the person cancelled.
async function saveFile(name, text, type) {
  const file = new File([text], name, { type });
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

function csvCell(value) {
  let text = String(value == null ? '' : value);
  // Stops a spreadsheet from treating typed text as a formula.
  if (/^[=@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv() {
  const header = ALL_FIELDS.map((f) => f.label).concat('Notes');
  const lines = customers
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map((c) => {
      const notes = (c.notes || [])
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((n) => `${formatDate(n.date)}: ${n.text}`)
        .join('\n');
      return ALL_FIELDS.map((f) => c[f.key]).concat(notes).map(csvCell).join(',');
    });
  // The leading marker makes Excel read accented characters correctly.
  return '﻿' + [header.map(csvCell).join(',')].concat(lines).join('\r\n');
}

function readBackup(text) {
  const data = JSON.parse(text);
  if (!data || data.app !== 'amanda-crm' || !Array.isArray(data.customers)) throw new Error('not a backup');
  if (!data.customers.every((c) => c && typeof c.id === 'string' && typeof c.name === 'string')) {
    throw new Error('bad customer');
  }
  return data.customers;
}

function renderBackup() {
  let last = null;
  try { last = localStorage.getItem(LAST_BACKUP_KEY); } catch (err) { /* storage unavailable */ }

  app.innerHTML = `
    <h1>Backup</h1>
    <section class="card">
      <h2>Save a backup</h2>
      <p>Saves every customer and note into one file. Keep it in iCloud Drive or another safe place.
         Customer data lives only on this device, so a backup file is the only way to get it back
         if the device is lost or the app's data is cleared.</p>
      <p class="muted" id="last-backup">Last backup from this device: ${last ? esc(formatDate(last)) : 'never'}</p>
      <button class="btn btn-primary" id="backup-btn" type="button">Save backup file</button>
    </section>
    <section class="card">
      <h2>Restore from a backup</h2>
      <p>Replaces everything in the app with the contents of a backup file.</p>
      <label class="btn" for="restore-file">Choose backup file</label>
      <input id="restore-file" type="file" accept=".json,application/json" hidden>
    </section>
    <section class="card">
      <h2>Export to a spreadsheet</h2>
      <p>Saves a CSV file that opens in Excel or Numbers. This is for reading or printing;
         it cannot be used to restore.</p>
      <button class="btn" id="csv-btn" type="button">Save spreadsheet file</button>
    </section>
    <p class="status" id="backup-status" role="status"></p>`;

  const status = document.getElementById('backup-status');

  document.getElementById('backup-btn').addEventListener('click', async () => {
    const backup = { app: 'amanda-crm', version: 1, exportedAt: new Date().toISOString(), customers };
    const saved = await saveFile(`amanda-crm-backup-${today()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    if (!saved) return;
    try { localStorage.setItem(LAST_BACKUP_KEY, today()); } catch (err) { /* storage unavailable */ }
    document.getElementById('last-backup').textContent = `Last backup from this device: ${formatDate(today())}`;
    status.textContent = `Backup of ${customers.length} customer${customers.length === 1 ? '' : 's'} saved.`;
  });

  document.getElementById('csv-btn').addEventListener('click', async () => {
    const saved = await saveFile(`amanda-crm-customers-${today()}.csv`, buildCsv(), 'text/csv');
    if (saved) status.textContent = 'Spreadsheet file saved.';
  });

  document.getElementById('restore-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let restored;
    try {
      restored = readBackup(await file.text());
    } catch (err) {
      status.textContent = 'That file is not a backup from this app. Nothing was changed.';
      return;
    }
    const question = `Replace the ${customers.length} customer${customers.length === 1 ? '' : 's'} in the app ` +
      `with the ${restored.length} in this backup? This cannot be undone.`;
    if (!confirm(question)) return;
    try {
      await replaceAllCustomers(restored);
    } catch (err) {
      status.textContent = 'The restore failed. Nothing was changed.';
      return;
    }
    status.textContent = `Restored ${restored.length} customer${restored.length === 1 ? '' : 's'}.`;
  });
}

// ---------- routing ----------

function route() {
  const hash = location.hash || '#/';
  const idFrom = (prefix) => customers.find((c) => c.id === hash.slice(prefix.length));
  let section = 'customers';

  if (hash === '#/new') {
    renderForm(null);
  } else if (hash === '#/followups') {
    section = 'followups';
    renderFollowUps();
  } else if (hash === '#/backup') {
    section = 'backup';
    renderBackup();
  } else if (hash.startsWith('#/edit/') && idFrom('#/edit/')) {
    renderForm(idFrom('#/edit/'));
  } else if (hash.startsWith('#/customer/') && idFrom('#/customer/')) {
    renderDetail(idFrom('#/customer/'));
  } else {
    renderList();
  }

  document.querySelectorAll('.nav a').forEach((link) => {
    link.classList.toggle('current', link.dataset.section === section);
  });
  window.scrollTo(0, 0);
}

async function start() {
  try {
    db = await openDb();
    customers = await loadCustomers();
  } catch (err) {
    app.innerHTML = '<p class="empty">This browser could not open the customer database. ' +
      'If you are in a private browsing window, close it and use a normal one.</p>';
    return;
  }
  // Ask the browser not to clear this app's data when the device is low on space.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  // The service worker keeps a copy of the app on the device so it opens without internet.
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('hashchange', route);
  route();
}

start();
