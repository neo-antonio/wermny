(function () {
  'use strict';

  /* ---------------------------------------------------------
     Constants
  --------------------------------------------------------- */
  const STORAGE_KEY = 'wermny_data_v1';

  const CURRENCIES = [
    { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
    { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' }
  ];
  const ZERO_DECIMAL_CODES = ['JPY', 'KRW'];

  const TYPE_META = {
    income:    { label: 'Income',    sign: 1,  direction: 'in',  debtDelta: 0 },
    received:  { label: 'Received',  sign: 1,  direction: 'in',  debtDelta: 0 },
    borrowed:  { label: 'Borrowed',  sign: 1,  direction: 'in',  debtDelta: 1 },
    expense:   { label: 'Expense',   sign: -1, direction: 'out', debtDelta: 0 },
    lent:      { label: 'Lent',      sign: -1, direction: 'out', debtDelta: 0 },
    repayment: { label: 'Repayment', sign: -1, direction: 'out', debtDelta: -1 }
  };
  const TYPE_ORDER = ['expense', 'income', 'borrowed', 'lent', 'repayment', 'received'];

  const CHART_PALETTE = ['#5F9A7B', '#C96E7A', '#8A7BC4', '#5D93BE', '#C99B4A', '#B85F6A', '#4F8B8B', '#A67C52'];

  const ICON_IN = '<path d="M17 7L7 17"></path><path d="M7 9v8h8"></path>';
  const ICON_OUT = '<path d="M7 17L17 7"></path><path d="M9 7h8v8"></path>';

  const PALETTES = [
    { key: 'lavender', name: 'Light Purple', bg: '#F3EEFA', accent: '#B9AEE0', accentDark: '#8A7BC4', accentTint: '#ECE8F7' },
    { key: 'sage',      name: 'Sage Green',   bg: '#F7F2EA', accent: '#8FBBA0', accentDark: '#5F9A7B', accentTint: '#E1EFE6' },
    { key: 'blush',     name: 'Blush Pink',   bg: '#FBF0F1', accent: '#EFA6AE', accentDark: '#C96E7A', accentTint: '#FBE6E9' },
    { key: 'sky',       name: 'Sky Blue',     bg: '#EFF6FB', accent: '#9BC4E2', accentDark: '#5D93BE', accentTint: '#E4EFF7' },
    { key: 'peach',     name: 'Peach',        bg: '#FBF3EA', accent: '#EFC98A', accentDark: '#C99B4A', accentTint: '#FBF0DE' },
    { key: 'mint',      name: 'Mint',         bg: '#EEF8F3', accent: '#8FD9B6', accentDark: '#4F9A72', accentTint: '#DFF3E9' }
  ];

  /* ---------------------------------------------------------
     State
  --------------------------------------------------------- */
  function defaultState() {
    return {
      accounts: [
        { id: uid('acc'), name: 'Cash', balance: 0, createdAt: Date.now() }
      ],
      transactions: [],
      categories: [
        { id: uid('cat'), name: 'Food', icon: null, subcategories: [] },
        { id: uid('cat'), name: 'Transportation', icon: null, subcategories: [] },
        { id: uid('cat'), name: 'Shopping', icon: null, subcategories: [] }
      ],
      settings: {
        currency: 'PHP',
        profileName: '',
        profilePhoto: null,
        memberSince: todayISO(),
        paletteKey: 'lavender',
        accountSortMode: 'custom',
        statsExcludedCategoryIds: []
      }
    };
  }

  let state = loadState();

  function migrateState(s) {
    s.accounts.forEach(function (a, i) { if (!a.createdAt) a.createdAt = Date.now() - (s.accounts.length - i) * 1000; });
    s.categories.forEach(function (c) {
      if (c.icon === undefined) c.icon = null;
      (c.subcategories || []).forEach(function (sub) { if (sub.icon === undefined) sub.icon = null; });
    });
    if (s.settings.profilePhoto === undefined) s.settings.profilePhoto = null;
    if (!s.settings.paletteKey) s.settings.paletteKey = 'lavender';
    if (!s.settings.accountSortMode) s.settings.accountSortMode = 'custom';
    if (!s.settings.statsExcludedCategoryIds) s.settings.statsExcludedCategoryIds = [];
    return s;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed.accounts || !parsed.categories) return defaultState();
      return migrateState(parsed);
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /* ---------------------------------------------------------
     Utilities
  --------------------------------------------------------- */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function parseISODate(iso) {
    const parts = iso.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatMoney(amount, code) {
    const cur = CURRENCIES.find(function (c) { return c.code === code; }) || CURRENCIES[0];
    const decimals = ZERO_DECIMAL_CODES.indexOf(code) > -1 ? 0 : 2;
    const sign = amount < 0 ? '-' : '';
    const abs = Math.abs(amount);
    return sign + cur.symbol + abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function fmt(amount) {
    return formatMoney(amount, state.settings.currency);
  }

  function formatDateHuman(iso) {
    const d = parseISODate(iso);
    const t = parseISODate(todayISO());
    const diffDays = Math.round((t - d) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== t.getFullYear() ? 'numeric' : undefined });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function getAccount(id) { return state.accounts.find(function (a) { return a.id === id; }); }
  function getCategory(id) { return state.categories.find(function (c) { return c.id === id; }); }
  function getSubcategory(cat, id) {
    if (!cat) return null;
    return cat.subcategories.find(function (s) { return s.id === id; });
  }
  function categoryLabel(tx) {
    const cat = getCategory(tx.categoryId);
    if (!cat) return 'Uncategorized';
    const sub = tx.subcategoryId ? getSubcategory(cat, tx.subcategoryId) : null;
    return sub ? cat.name + ' · ' + sub.name : cat.name;
  }
  function txIconHtml(t) {
    const meta = TYPE_META[t.type];
    const arrow = meta.direction === 'in' ? ICON_IN : ICON_OUT;
    const cat = getCategory(t.categoryId);
    const sub = cat && t.subcategoryId ? getSubcategory(cat, t.subcategoryId) : null;
    const photo = (sub && sub.icon) || (cat && cat.icon) || null;
    if (photo) {
      return '<img class="tx-icon-img" src="' + escapeHtml(photo) + '" alt="">' +
        '<span class="tx-icon-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + arrow + '</svg></span>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + arrow + '</svg>';
  }

  /* ---------------------------------------------------------
     Transaction ledger effects
  --------------------------------------------------------- */
  function txEffect(tx) {
    return TYPE_META[tx.type].sign * tx.amount;
  }

  function applyTransaction(tx) {
    const acc = getAccount(tx.accountId);
    if (acc) acc.balance += txEffect(tx);
  }

  function reverseTransaction(tx) {
    const acc = getAccount(tx.accountId);
    if (acc) acc.balance -= txEffect(tx);
  }

  function addTransaction(data) {
    const tx = {
      id: uid('tx'),
      amount: data.amount,
      type: data.type,
      date: data.date,
      accountId: data.accountId,
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId || null,
      note: data.note,
      settlesId: data.settlesId || null,
      createdAt: Date.now()
    };
    state.transactions.push(tx);
    applyTransaction(tx);
    saveState();
  }

  function updateTransaction(id, data) {
    const tx = state.transactions.find(function (t) { return t.id === id; });
    if (!tx) return;
    reverseTransaction(tx);
    tx.amount = data.amount;
    tx.type = data.type;
    tx.date = data.date;
    tx.accountId = data.accountId;
    tx.categoryId = data.categoryId;
    tx.subcategoryId = data.subcategoryId || null;
    tx.note = data.note;
    tx.settlesId = data.settlesId || null;
    applyTransaction(tx);
    saveState();
  }

  /* ---------------------------------------------------------
     Debt / receivable ledger (partial or full settlement)
  --------------------------------------------------------- */
  // targetTx is a 'borrowed' or 'lent' transaction. Returns how much of it
  // is still unpaid, optionally excluding one settling transaction's own
  // contribution (used while editing that settling transaction).
  function getOutstanding(targetTx, excludeTxId) {
    const settleType = targetTx.type === 'borrowed' ? 'repayment' : 'received';
    let paid = 0;
    state.transactions.forEach(function (t) {
      if (t.type === settleType && t.settlesId === targetTx.id && t.id !== excludeTxId) paid += t.amount;
    });
    const remaining = targetTx.amount - paid;
    return remaining < 0.005 ? 0 : remaining;
  }

  // ledgerType: 'borrowed' (debt) or 'lent' (receivables)
  function getOpenLedger(ledgerType) {
    return state.transactions
      .filter(function (t) { return t.type === ledgerType && getOutstanding(t) > 0.004; })
      .sort(function (a, b) { return b.date.localeCompare(a.date) || b.createdAt - a.createdAt; });
  }

  function deleteTransaction(id) {
    const idx = state.transactions.findIndex(function (t) { return t.id === id; });
    if (idx === -1) return;
    reverseTransaction(state.transactions[idx]);
    state.transactions.splice(idx, 1);
    saveState();
  }

  /* ---------------------------------------------------------
     Date range filters
  --------------------------------------------------------- */
  function computeRange(preset, customStart, customEnd) {
    const now = new Date();
    let start = null, end = null;
    if (preset === 'all') {
      return { start: null, end: null };
    } else if (preset === 'week') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (preset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (preset === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (preset === 'custom') {
      start = customStart ? parseISODate(customStart) : null;
      end = customEnd ? parseISODate(customEnd) : null;
    }
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    return { start: start, end: end };
  }

  function rangeLabel(preset, customStart, customEnd) {
    if (preset === 'all') return 'All time';
    if (preset === 'week') return 'This week';
    if (preset === 'month') return 'This month';
    if (preset === 'year') return 'This year';
    if (preset === 'custom' && customStart && customEnd) {
      const s = parseISODate(customStart), e = parseISODate(customEnd);
      const opts = { month: 'short', day: 'numeric' };
      return s.toLocaleDateString('en-US', opts) + ' - ' + e.toLocaleDateString('en-US', opts);
    }
    return 'Custom range';
  }

  function inRange(dateIso, range) {
    if (!range.start && !range.end) return true;
    const d = parseISODate(dateIso);
    if (range.start && d < range.start) return false;
    if (range.end && d > range.end) return false;
    return true;
  }

  const txFilter = { preset: 'month', customStart: null, customEnd: null };
  const statsFilter = { preset: 'month', customStart: null, customEnd: null };
  let statsType = 'expense';
  let txLimit = 20;

  /* ---------------------------------------------------------
     DOM refs
  --------------------------------------------------------- */
  const $ = function (sel) { return document.querySelector(sel); };
  const $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  const modalOverlay = $('#modalOverlay');
  const modalTitle = $('#modalTitle');
  const modalBody = $('#modalBody');
  const sheetOverlay = $('#sheetOverlay');
  const sheetTitle = $('#sheetTitle');
  const sheetBody = $('#sheetBody');
  const toastEl = $('#toast');
  const fabBtn = $('#fabBtn');

  /* ---------------------------------------------------------
     Modal / Sheet / Toast system
  --------------------------------------------------------- */
  function openModal(title, bodyHtml, onMount) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalOverlay.hidden = false;
    if (typeof onMount === 'function') onMount(modalBody);
  }
  function closeModal() { modalOverlay.hidden = true; modalBody.innerHTML = ''; }

  function openSheet(title, actions) {
    sheetTitle.textContent = title;
    sheetBody.innerHTML = actions.map(function (a, i) {
      return '<button type="button" class="sheet-action' + (a.danger ? ' is-danger' : '') + '" data-idx="' + i + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + a.icon + '</svg><span>' + escapeHtml(a.label) + '</span></button>';
    }).join('');
    Array.prototype.forEach.call(sheetBody.querySelectorAll('.sheet-action'), function (btn) {
      btn.addEventListener('click', function () {
        closeSheet();
        actions[Number(btn.getAttribute('data-idx'))].onClick();
      });
    });
    sheetOverlay.hidden = false;
  }
  function closeSheet() { sheetOverlay.hidden = true; sheetBody.innerHTML = ''; }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }

  modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) closeModal(); });
  sheetOverlay.addEventListener('click', function (e) { if (e.target === sheetOverlay) closeSheet(); });
  $('#modalCloseBtn').addEventListener('click', closeModal);

  function openConfirm(opts) {
    openModal(opts.title, '' +
      '<p style="font-size:14px;color:var(--text-muted);line-height:1.5;">' + escapeHtml(opts.message) + '</p>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" id="confirmCancelBtn">Cancel</button>' +
        '<button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" id="confirmOkBtn">' + escapeHtml(opts.confirmLabel || 'Confirm') + '</button>' +
      '</div>', function (body) {
      body.querySelector('#confirmCancelBtn').addEventListener('click', closeModal);
      body.querySelector('#confirmOkBtn').addEventListener('click', function () {
        closeModal();
        opts.onConfirm();
      });
    });
  }

  /* ---------------------------------------------------------
     Generic image picker (used by profile / category / subcategory)
  --------------------------------------------------------- */
  const globalImageFileInput = $('#globalImageFileInput');

  function openImagePicker(opts) {
    const body = '' +
      '<div class="photo-picker-preview" id="photoPreview">' +
        (opts.currentUrl ? '' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="10" r="1.5"></circle><path d="M21 16l-5-5-4 4-2-2-5 5"></path></svg>') +
      '</div>' +
      '<div class="photo-picker-actions">' +
        '<button type="button" class="btn btn-secondary" id="photoChooseBtn">Choose from gallery or files</button>' +
        '<div class="photo-picker-divider">or</div>' +
        '<div class="field-with-add">' +
          '<input type="text" class="text-input" id="photoUrlInput" placeholder="Paste an image address">' +
          '<button type="button" class="small-icon-btn" id="photoUrlSaveBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"></path></svg></button>' +
        '</div>' +
        (opts.currentUrl ? '<button type="button" class="photo-picker-remove" id="photoRemoveBtn">Remove photo</button>' : '') +
      '</div>';

    openModal(opts.title || 'Photo', body, function (root) {
      const preview = root.querySelector('#photoPreview');
      if (opts.currentUrl) preview.style.backgroundImage = 'url(' + JSON.stringify(opts.currentUrl) + ')';

      root.querySelector('#photoChooseBtn').addEventListener('click', function () {
        globalImageFileInput.onchange = function () {
          const file = globalImageFileInput.files && globalImageFileInput.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function () {
            closeModal();
            opts.onSelect(reader.result);
          };
          reader.readAsDataURL(file);
          globalImageFileInput.value = '';
        };
        globalImageFileInput.click();
      });

      root.querySelector('#photoUrlSaveBtn').addEventListener('click', function () {
        const url = root.querySelector('#photoUrlInput').value.trim();
        if (!url) { showToast('Paste an image address first'); return; }
        closeModal();
        opts.onSelect(url);
      });

      if (opts.currentUrl) {
        root.querySelector('#photoRemoveBtn').addEventListener('click', function () {
          closeModal();
          if (opts.onRemove) opts.onRemove();
        });
      }
    });
  }

  /* ---------------------------------------------------------
     Color palette
  --------------------------------------------------------- */
  function applyPalette(key) {
    const palette = PALETTES.find(function (p) { return p.key === key; }) || PALETTES[0];
    const root = document.documentElement.style;
    root.setProperty('--bg', palette.bg);
    root.setProperty('--accent', palette.accent);
    root.setProperty('--accent-dark', palette.accentDark);
    root.setProperty('--accent-tint', palette.accentTint);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', palette.bg);
  }

  function openPaletteModal() {
    const html = '<div class="palette-swatch-grid">' + PALETTES.map(function (p) {
      const selected = p.key === state.settings.paletteKey;
      return '' +
        '<button type="button" class="palette-swatch-row' + (selected ? ' is-selected' : '') + '" data-key="' + p.key + '">' +
          '<span class="palette-swatch-circle" style="background:' + p.accent + '"></span>' +
          '<span class="palette-swatch-name">' + escapeHtml(p.name) + '</span>' +
          (selected ? '<svg class="palette-swatch-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"></path></svg>' : '') +
        '</button>';
    }).join('') + '</div>';
    openModal('Color palette', html, function (root) {
      Array.prototype.forEach.call(root.querySelectorAll('.palette-swatch-row'), function (btn) {
        btn.addEventListener('click', function () {
          state.settings.paletteKey = btn.getAttribute('data-key');
          saveState();
          applyPalette(state.settings.paletteKey);
          closeModal();
          renderSettings();
        });
      });
    });
  }
  $('#settingsPaletteRow').addEventListener('click', openPaletteModal);

  /* ---------------------------------------------------------
     Tab / subnav navigation
  --------------------------------------------------------- */
  function switchTab(tab) {
    $$('.tab-view').forEach(function (v) { v.classList.remove('is-active'); });
    $('#view-' + tab).classList.add('is-active');
    $$('.nav-btn').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-tab') === tab); });
    fabBtn.classList.toggle('is-visible', tab === 'transactions' || tab === 'accounts');
    fabBtn.setAttribute('data-context', tab);
    if (tab === 'transactions') renderTransactions();
    if (tab === 'accounts') renderAccounts();
    if (tab === 'more') renderMoreActiveSub();
  }
  $$('.nav-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-tab')); });
  });

  function switchMoreSub(sub) {
    $$('.more-subnav-btn').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-sub') === sub); });
    $$('.sub-view').forEach(function (v) { v.classList.remove('is-active'); });
    $('#sub-' + sub).classList.add('is-active');
    renderMoreActiveSub();
  }
  $$('.more-subnav-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { switchMoreSub(btn.getAttribute('data-sub')); });
  });
  function renderMoreActiveSub() {
    const active = $('.more-subnav-btn.is-active').getAttribute('data-sub');
    if (active === 'profile') renderProfile();
    if (active === 'categories') renderCategories();
    if (active === 'statistics') renderStatistics();
    if (active === 'settings') renderSettings();
  }

  /* ---------------------------------------------------------
     FAB
  --------------------------------------------------------- */
  fabBtn.addEventListener('click', function () {
    const ctx = fabBtn.getAttribute('data-context');
    if (ctx === 'accounts') openAccountModal(null);
    else openTransactionModal(null);
  });

  /* ---------------------------------------------------------
     Stats rendering (top of Transactions tab)
  --------------------------------------------------------- */
  function renderStats() {
    const netWorth = state.accounts.reduce(function (s, a) { return s + a.balance; }, 0);
    const debt = getOpenLedger('borrowed').reduce(function (s, t) { return s + getOutstanding(t); }, 0);
    const receivable = getOpenLedger('lent').reduce(function (s, t) { return s + getOutstanding(t); }, 0);

    const range = computeRange(txFilter.preset, txFilter.customStart, txFilter.customEnd);
    let inflow = 0, outflow = 0;
    state.transactions.forEach(function (t) {
      if (!inRange(t.date, range)) return;
      if (TYPE_META[t.type].direction === 'in') inflow += t.amount;
      else outflow += t.amount;
    });

    $('#statNetWorth').textContent = fmt(netWorth);
    $('#statDebt').textContent = fmt(debt);
    $('#statReceivable').textContent = fmt(receivable);
    $('#statInflow').textContent = fmt(inflow);
    $('#statOutflow').textContent = fmt(outflow);
  }

  $('#statDebtBtn').addEventListener('click', function () { openLedgerModal('borrowed'); });
  $('#statReceivableBtn').addEventListener('click', function () { openLedgerModal('lent'); });

  function openLedgerModal(ledgerType) {
    const items = getOpenLedger(ledgerType);
    const title = ledgerType === 'borrowed' ? 'Debt' : 'Receivables';
    if (items.length === 0) {
      openModal(title, '<p style="font-size:13.5px;color:var(--text-muted);text-align:center;padding:16px 0;">Nothing outstanding here.</p>', null);
      return;
    }
    const html = '<div class="ledger-list">' + items.map(function (t) {
      const remaining = getOutstanding(t);
      return '' +
        '<div class="ledger-item" data-id="' + t.id + '">' +
          '<div class="ledger-info">' +
            '<div class="ledger-note">' + escapeHtml(t.note || TYPE_META[t.type].label) + '</div>' +
            '<div class="ledger-meta">' + formatDateHuman(t.date) + ' · ' + escapeHtml(categoryLabel(t)) + '</div>' +
          '</div>' +
          '<button type="button" class="ledger-settle-btn" data-id="' + t.id + '">' +
            '<span class="ledger-remaining">' + fmt(remaining) + '</span><span class="ledger-slash">/</span><span class="ledger-original">' + fmt(t.amount) + '</span>' +
          '</button>' +
        '</div>';
    }).join('') + '</div>';
    openModal(title, html, function (root) {
      Array.prototype.forEach.call(root.querySelectorAll('.ledger-settle-btn'), function (btn) {
        btn.addEventListener('click', function () {
          const tx = items.find(function (t) { return t.id === btn.getAttribute('data-id'); });
          closeModal();
          openTransactionModal(null, {
            type: ledgerType === 'borrowed' ? 'repayment' : 'received',
            settlesId: tx.id,
            amount: getOutstanding(tx),
            categoryId: tx.categoryId,
            subcategoryId: tx.subcategoryId
          });
        });
      });
    });
  }

  /* ---------------------------------------------------------
     Transactions tab
  --------------------------------------------------------- */
  function renderTransactions() {
    renderStats();
    $('#txFilterLabel').textContent = rangeLabel(txFilter.preset, txFilter.customStart, txFilter.customEnd);

    const range = computeRange(txFilter.preset, txFilter.customStart, txFilter.customEnd);
    const filtered = state.transactions
      .filter(function (t) { return inRange(t.date, range); })
      .sort(function (a, b) { return b.date.localeCompare(a.date) || b.createdAt - a.createdAt; });

    const listEl = $('#txList');
    const emptyEl = $('#txEmpty');
    const seeMoreBtn = $('#txSeeMoreBtn');

    if (filtered.length === 0) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      seeMoreBtn.hidden = true;
      return;
    }
    emptyEl.hidden = true;

    const visible = filtered.slice(0, txLimit);
    let html = '';
    let lastDate = null;
    visible.forEach(function (t) {
      if (t.date !== lastDate) {
        html += '<div class="tx-date-heading">' + formatDateHuman(t.date) + '</div>';
        lastDate = t.date;
      }
      const meta = TYPE_META[t.type];
      const sign = meta.direction === 'in' ? '+' : '-';
      html += '' +
        '<div class="tx-item type-' + t.type + '" data-id="' + t.id + '">' +
          '<div class="tx-icon">' + txIconHtml(t) + '</div>' +
          '<div class="tx-body">' +
            '<div class="tx-category">' + escapeHtml(categoryLabel(t)) + '</div>' +
            '<div class="tx-note">' + escapeHtml(t.note || meta.label) + '</div>' +
          '</div>' +
          '<div class="tx-amount">' + sign + fmt(t.amount) + '</div>' +
        '</div>';
    });
    listEl.innerHTML = html;

    Array.prototype.forEach.call(listEl.querySelectorAll('.tx-item'), function (el) {
      el.addEventListener('click', function () {
        const tx = state.transactions.find(function (t) { return t.id === el.getAttribute('data-id'); });
        if (tx) openTransactionModal(tx);
      });
    });

    seeMoreBtn.hidden = filtered.length <= txLimit;
  }
  $('#txSeeMoreBtn').addEventListener('click', function () { txLimit += 20; renderTransactions(); });

  $('#txSearchBtn').addEventListener('click', openSearchModal);

  function openSearchModal() {
    const body = '' +
      '<input type="text" class="text-input" id="txSearchInput" placeholder="Search notes or categories" autocomplete="off">' +
      '<div id="txSearchResults" class="tx-list" style="margin-top:4px;"></div>';
    openModal('Search transactions', body, function (root) {
      const input = root.querySelector('#txSearchInput');
      const resultsEl = root.querySelector('#txSearchResults');

      function renderResults(query) {
        const q = query.trim().toLowerCase();
        if (!q) { resultsEl.innerHTML = ''; return; }
        const matches = state.transactions
          .filter(function (t) {
            return (t.note || '').toLowerCase().indexOf(q) > -1 || categoryLabel(t).toLowerCase().indexOf(q) > -1;
          })
          .sort(function (a, b) { return b.date.localeCompare(a.date) || b.createdAt - a.createdAt; })
          .slice(0, 30);

        if (matches.length === 0) {
          resultsEl.innerHTML = '<p style="font-size:13px;color:var(--text-muted);text-align:center;padding:18px 0;">No matches</p>';
          return;
        }
        resultsEl.innerHTML = matches.map(function (t) {
          const meta = TYPE_META[t.type];
          const sign = meta.direction === 'in' ? '+' : '-';
          return '' +
            '<div class="tx-item type-' + t.type + '" data-id="' + t.id + '">' +
              '<div class="tx-icon">' + txIconHtml(t) + '</div>' +
              '<div class="tx-body">' +
                '<div class="tx-category">' + escapeHtml(categoryLabel(t)) + '</div>' +
                '<div class="tx-note">' + escapeHtml(t.note || meta.label) + ' · ' + formatDateHuman(t.date) + '</div>' +
              '</div>' +
              '<div class="tx-amount">' + sign + fmt(t.amount) + '</div>' +
            '</div>';
        }).join('');
        Array.prototype.forEach.call(resultsEl.querySelectorAll('.tx-item'), function (el) {
          el.addEventListener('click', function () {
            const tx = state.transactions.find(function (t) { return t.id === el.getAttribute('data-id'); });
            closeModal();
            if (tx) openTransactionModal(tx);
          });
        });
      }

      input.addEventListener('input', function () { renderResults(input.value); });
      setTimeout(function () { input.focus(); }, 60);
    });
  }

  $('#txFilterBtn').addEventListener('click', function () {
    openDateFilterModal('Filter transactions', txFilter, function (preset, cs, ce) {
      txFilter.preset = preset; txFilter.customStart = cs; txFilter.customEnd = ce;
      txLimit = 20;
      renderTransactions();
    });
  });

  function openDateFilterModal(title, filterState, onApply) {
    const presets = [
      { key: 'all', label: 'All time' },
      { key: 'week', label: 'This week' },
      { key: 'month', label: 'This month' },
      { key: 'year', label: 'This year' },
      { key: 'custom', label: 'Custom' }
    ];
    const body = '' +
      '<div class="range-chip-grid" id="rangeChipGrid">' +
      presets.map(function (p) {
        return '<button type="button" class="range-chip' + (filterState.preset === p.key ? ' is-active' : '') + '" data-preset="' + p.key + '">' + p.label + '</button>';
      }).join('') +
      '</div>' +
      '<div id="customDateRow" class="field-row" ' + (filterState.preset === 'custom' ? '' : 'hidden') + '>' +
        '<div><label class="field-label">From</label><input type="date" class="text-input" id="customStartInput" value="' + (filterState.customStart || todayISO()) + '"></div>' +
        '<div><label class="field-label">To</label><input type="date" class="text-input" id="customEndInput" value="' + (filterState.customEnd || todayISO()) + '"></div>' +
      '</div>' +
      '<div class="modal-actions"><button type="button" class="btn btn-primary" id="applyFilterBtn">Apply</button></div>';

    openModal(title, body, function (root) {
      let preset = filterState.preset;
      Array.prototype.forEach.call(root.querySelectorAll('.range-chip'), function (chip) {
        chip.addEventListener('click', function () {
          preset = chip.getAttribute('data-preset');
          Array.prototype.forEach.call(root.querySelectorAll('.range-chip'), function (c) { c.classList.toggle('is-active', c === chip); });
          root.querySelector('#customDateRow').hidden = preset !== 'custom';
        });
      });
      root.querySelector('#applyFilterBtn').addEventListener('click', function () {
        const cs = root.querySelector('#customStartInput').value;
        const ce = root.querySelector('#customEndInput').value;
        closeModal();
        onApply(preset, cs, ce);
      });
    });
  }

  /* ---------------------------------------------------------
     Add / edit transaction modal
  --------------------------------------------------------- */
  function categoryOptionsHtml(selectedId) {
    return state.categories.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === selectedId ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>';
    }).join('');
  }
  function subcategoryOptionsHtml(cat, selectedId) {
    let html = '<option value="">No subcategory</option>';
    if (cat) {
      html += cat.subcategories.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === selectedId ? ' selected' : '') + '>' + escapeHtml(s.name) + '</option>';
      }).join('');
    }
    return html;
  }
  function accountOptionsHtml(selectedId) {
    return state.accounts.map(function (a) {
      return '<option value="' + a.id + '"' + (a.id === selectedId ? ' selected' : '') + '>' + escapeHtml(a.name) + '</option>';
    }).join('');
  }

  function buildSettleOptionsHtml(settleLedgerType, selectedId, excludeTxId) {
    const open = getOpenLedger(settleLedgerType).slice();
    if (selectedId && !open.some(function (t) { return t.id === selectedId; })) {
      const already = state.transactions.find(function (t) { return t.id === selectedId; });
      if (already) open.unshift(already);
    }
    if (open.length === 0) return { html: '<option value="">Nothing outstanding</option>', hasOptions: false };
    const html = open.map(function (t) {
      const remaining = getOutstanding(t, excludeTxId);
      return '<option value="' + t.id + '"' + (t.id === selectedId ? ' selected' : '') + '>' +
        escapeHtml(t.note || TYPE_META[t.type].label) + ' — ' + fmt(remaining) + ' left</option>';
    }).join('');
    return { html: html, hasOptions: true };
  }

  function openTransactionModal(existingTx, presetInitial) {
    if (state.accounts.length === 0) {
      showToast('Add an account first');
      openAccountModal(null);
      return;
    }
    const isEdit = !!existingTx;
    const initial = existingTx || Object.assign({
      amount: '', type: 'expense', date: todayISO(),
      accountId: state.accounts[0].id, categoryId: state.categories[0].id,
      subcategoryId: null, note: '', settlesId: null
    }, presetInitial || {});

    const body = '' +
      '<div>' +
        '<label class="field-label">Amount</label>' +
        '<input type="number" inputmode="decimal" step="0.01" min="0.01" class="text-input" id="txAmountInput" placeholder="0.00" value="' + (initial.amount || '') + '">' +
      '</div>' +
      '<div>' +
        '<label class="field-label">Type</label>' +
        '<div class="type-chip-grid" id="txTypeChips">' +
        TYPE_ORDER.map(function (key) {
          return '<button type="button" class="type-chip' + (initial.type === key ? ' is-active' : '') + '" data-type="' + key + '">' + TYPE_META[key].label + '</button>';
        }).join('') +
        '</div>' +
      '</div>' +
      '<div>' +
        '<label class="field-label">Date</label>' +
        '<input type="date" class="text-input" id="txDateInput" value="' + initial.date + '">' +
      '</div>' +
      '<div>' +
        '<label class="field-label">Account</label>' +
        '<select class="select-input" id="txAccountSelect">' + accountOptionsHtml(initial.accountId) + '</select>' +
      '</div>' +
      '<div id="txSettleFieldWrap" hidden>' +
        '<label class="field-label" id="txSettleLabel">Settling</label>' +
        '<select class="select-input" id="txSettleSelect"></select>' +
      '</div>' +
      '<div class="field-with-add">' +
        '<div style="flex:1"><label class="field-label">Category</label><select class="select-input" id="txCategorySelect">' + categoryOptionsHtml(initial.categoryId) + '</select></div>' +
        '<button type="button" class="small-icon-btn" id="txAddCatBtn" title="New category"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg></button>' +
      '</div>' +
      '<div class="field-with-add" id="txNewCatRow" hidden>' +
        '<input class="text-input" id="txNewCatInput" placeholder="New category name">' +
        '<button type="button" class="small-icon-btn" id="txNewCatSaveBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"></path></svg></button>' +
      '</div>' +
      '<div class="field-with-add">' +
        '<div style="flex:1"><label class="field-label">Subcategory</label><select class="select-input" id="txSubcategorySelect"></select></div>' +
        '<button type="button" class="small-icon-btn" id="txAddSubcatBtn" title="New subcategory"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg></button>' +
      '</div>' +
      '<div class="field-with-add" id="txNewSubcatRow" hidden>' +
        '<input class="text-input" id="txNewSubcatInput" placeholder="New subcategory name">' +
        '<button type="button" class="small-icon-btn" id="txNewSubcatSaveBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"></path></svg></button>' +
      '</div>' +
      '<div>' +
        '<label class="field-label">Note</label>' +
        '<textarea class="text-input" id="txNoteInput" placeholder="What is this for?">' + escapeHtml(initial.note || '') + '</textarea>' +
      '</div>' +
      '<div class="modal-actions">' +
        (isEdit ? '<button type="button" class="btn btn-danger" id="txDeleteBtn">Delete</button>' : '<button type="button" class="btn btn-secondary" id="txCancelBtn">Cancel</button>') +
        '<button type="button" class="btn btn-primary" id="txSaveBtn">' + (isEdit ? 'Save' : 'Add') + '</button>' +
      '</div>';

    openModal(isEdit ? 'Edit transaction' : 'Add transaction', body, function (root) {
      let selectedType = initial.type;
      root.querySelector('#txDateInput').value = initial.date;

      function refreshSubcategories() {
        const cat = getCategory(root.querySelector('#txCategorySelect').value);
        root.querySelector('#txSubcategorySelect').innerHTML = subcategoryOptionsHtml(cat, initial.subcategoryId);
      }
      refreshSubcategories();

      function refreshSettleField() {
        const wrap = root.querySelector('#txSettleFieldWrap');
        if (selectedType === 'repayment' || selectedType === 'received') {
          wrap.hidden = false;
          const ledgerType = selectedType === 'repayment' ? 'borrowed' : 'lent';
          root.querySelector('#txSettleLabel').textContent = selectedType === 'repayment' ? 'Paying off' : 'Receiving for';
          const result = buildSettleOptionsHtml(ledgerType, initial.settlesId, isEdit ? existingTx.id : null);
          root.querySelector('#txSettleSelect').innerHTML = result.html;
        } else {
          wrap.hidden = true;
        }
      }
      refreshSettleField();

      Array.prototype.forEach.call(root.querySelectorAll('.type-chip'), function (chip) {
        chip.addEventListener('click', function () {
          selectedType = chip.getAttribute('data-type');
          Array.prototype.forEach.call(root.querySelectorAll('.type-chip'), function (c) { c.classList.toggle('is-active', c === chip); });
          refreshSettleField();
        });
      });

      root.querySelector('#txCategorySelect').addEventListener('change', refreshSubcategories);

      root.querySelector('#txAddCatBtn').addEventListener('click', function () {
        root.querySelector('#txNewCatRow').hidden = !root.querySelector('#txNewCatRow').hidden;
        root.querySelector('#txNewCatInput').focus();
      });
      root.querySelector('#txNewCatSaveBtn').addEventListener('click', function () {
        const name = root.querySelector('#txNewCatInput').value.trim();
        if (!name) return;
        const cat = { id: uid('cat'), name: name, subcategories: [] };
        state.categories.push(cat);
        saveState();
        root.querySelector('#txCategorySelect').innerHTML = categoryOptionsHtml(cat.id);
        refreshSubcategories();
        root.querySelector('#txNewCatRow').hidden = true;
        root.querySelector('#txNewCatInput').value = '';
      });

      root.querySelector('#txAddSubcatBtn').addEventListener('click', function () {
        root.querySelector('#txNewSubcatRow').hidden = !root.querySelector('#txNewSubcatRow').hidden;
        root.querySelector('#txNewSubcatInput').focus();
      });
      root.querySelector('#txNewSubcatSaveBtn').addEventListener('click', function () {
        const name = root.querySelector('#txNewSubcatInput').value.trim();
        if (!name) return;
        const cat = getCategory(root.querySelector('#txCategorySelect').value);
        if (!cat) return;
        const sub = { id: uid('sub'), name: name };
        cat.subcategories.push(sub);
        saveState();
        root.querySelector('#txSubcategorySelect').innerHTML = subcategoryOptionsHtml(cat, sub.id);
        root.querySelector('#txNewSubcatRow').hidden = true;
        root.querySelector('#txNewSubcatInput').value = '';
      });

      if (isEdit) {
        root.querySelector('#txDeleteBtn').addEventListener('click', function () {
          closeModal();
          openConfirm({
            title: 'Delete transaction',
            message: 'This transaction will be permanently removed and account balances will be updated.',
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: function () {
              deleteTransaction(existingTx.id);
              renderTransactions(); renderAccounts();
              showToast('Transaction deleted');
            }
          });
        });
      } else {
        root.querySelector('#txCancelBtn').addEventListener('click', closeModal);
      }

      root.querySelector('#txSaveBtn').addEventListener('click', function () {
        const amount = parseFloat(root.querySelector('#txAmountInput').value);
        const date = root.querySelector('#txDateInput').value || todayISO();
        const accountId = root.querySelector('#txAccountSelect').value;
        const categoryId = root.querySelector('#txCategorySelect').value;
        const subcategoryId = root.querySelector('#txSubcategorySelect').value || null;
        const note = root.querySelector('#txNoteInput').value.trim();

        if (!amount || amount <= 0) { showToast('Enter a valid amount'); return; }
        if (!note) { showToast('Add a note'); return; }
        if (!categoryId) { showToast('Choose a category'); return; }

        let settlesId = null;
        if (selectedType === 'repayment' || selectedType === 'received') {
          settlesId = root.querySelector('#txSettleSelect').value;
          if (!settlesId) { showToast('Choose what this settles'); return; }
          const target = state.transactions.find(function (t) { return t.id === settlesId; });
          const remaining = getOutstanding(target, isEdit ? existingTx.id : null);
          if (amount > remaining + 0.005) { showToast('That is more than the ' + fmt(remaining) + ' still owed'); return; }
        }

        const data = { amount: amount, type: selectedType, date: date, accountId: accountId, categoryId: categoryId, subcategoryId: subcategoryId, note: note, settlesId: settlesId };
        if (isEdit) updateTransaction(existingTx.id, data);
        else addTransaction(data);

        closeModal();
        renderTransactions(); renderAccounts();
        showToast(isEdit ? 'Transaction updated' : 'Transaction added');
      });
    });
  }

  /* ---------------------------------------------------------
     Accounts tab
  --------------------------------------------------------- */
  function renderAccounts() {
    const listEl = $('#accountsList');
    const emptyEl = $('#accountsEmpty');
    const total = state.accounts.reduce(function (s, a) { return s + a.balance; }, 0);
    $('#accountsTotal').textContent = fmt(total) + ' total';

    if (state.accounts.length === 0) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    const mode = state.settings.accountSortMode;
    let ordered;
    if (mode === 'alpha') ordered = state.accounts.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    else if (mode === 'recent') ordered = state.accounts.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    else ordered = state.accounts;
    const isCustom = mode === 'custom';

    listEl.innerHTML = ordered.map(function (a, i) {
      return '' +
        '<div class="account-card" data-id="' + a.id + '">' +
          '<div class="account-emblem">' + escapeHtml(a.name.slice(0, 1).toUpperCase()) + '</div>' +
          '<div class="account-info">' +
            '<div class="account-name">' + escapeHtml(a.name) + '</div>' +
            '<div class="account-balance">' + fmt(a.balance) + '</div>' +
          '</div>' +
          (isCustom ? '' +
            '<div class="account-reorder">' +
              '<button type="button" class="account-reorder-btn" data-dir="-1" data-id="' + a.id + '"' + (i === 0 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"></path></svg></button>' +
              '<button type="button" class="account-reorder-btn" data-dir="1" data-id="' + a.id + '"' + (i === ordered.length - 1 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg></button>' +
            '</div>' : '') +
          '<button type="button" class="account-menu-btn" data-id="' + a.id + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.4"></circle><circle cx="12" cy="12" r="1.4"></circle><circle cx="12" cy="19" r="1.4"></circle></svg>' +
          '</button>' +
        '</div>';
    }).join('');

    Array.prototype.forEach.call(listEl.querySelectorAll('.account-menu-btn'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openAccountMenu(getAccount(btn.getAttribute('data-id')));
      });
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('.account-reorder-btn'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        moveAccount(btn.getAttribute('data-id'), Number(btn.getAttribute('data-dir')));
      });
    });
  }

  function moveAccount(id, dir) {
    const idx = state.accounts.findIndex(function (a) { return a.id === id; });
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= state.accounts.length) return;
    const tmp = state.accounts[idx];
    state.accounts[idx] = state.accounts[target];
    state.accounts[target] = tmp;
    saveState();
    renderAccounts();
  }

  $('#accountsSortBtn').addEventListener('click', function () {
    const mode = state.settings.accountSortMode;
    const checkIcon = '<path d="M5 13l4 4L19 7"></path>';
    const blankIcon = '<circle cx="12" cy="12" r="1"></circle>';
    openSheet('Sort accounts', [
      { label: 'Alphabetical', icon: mode === 'alpha' ? checkIcon : blankIcon, onClick: function () { setAccountSort('alpha'); } },
      { label: 'Last added', icon: mode === 'recent' ? checkIcon : blankIcon, onClick: function () { setAccountSort('recent'); } },
      { label: 'My own order', icon: mode === 'custom' ? checkIcon : blankIcon, onClick: function () { setAccountSort('custom'); } }
    ]);
  });
  function setAccountSort(mode) {
    state.settings.accountSortMode = mode;
    saveState();
    renderAccounts();
  }

  function openAccountMenu(account) {
    openSheet(account.name, [
      {
        label: 'Edit name', icon: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>',
        onClick: function () { openEditAccountNameModal(account); }
      },
      {
        label: 'Transfer funds', icon: '<path d="M7 7h11l-3-3"></path><path d="M17 17H6l3 3"></path>',
        onClick: function () { openTransferFundsModal(account); }
      },
      {
        label: 'Delete account', icon: '<path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M6 7l1 13h10l1-13"></path>', danger: true,
        onClick: function () {
          openConfirm({
            title: 'Delete ' + account.name + '?',
            message: 'This removes the account and every transaction linked to it. This cannot be undone.',
            confirmLabel: 'Delete', danger: true,
            onConfirm: function () {
              state.transactions = state.transactions.filter(function (t) { return t.accountId !== account.id; });
              state.accounts = state.accounts.filter(function (a) { return a.id !== account.id; });
              saveState();
              renderAccounts(); renderTransactions();
              showToast('Account deleted');
            }
          });
        }
      }
    ]);
  }

  function openAccountModal() {
    const body = '' +
      '<div><label class="field-label">Account name</label><input class="text-input" id="accNameInput" placeholder="e.g. Savings, GCash"></div>' +
      '<div><label class="field-label">Starting balance</label><input type="number" step="0.01" class="text-input" id="accBalanceInput" placeholder="0.00" value="0"></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" id="accCancelBtn">Cancel</button>' +
        '<button type="button" class="btn btn-primary" id="accSaveBtn">Add</button>' +
      '</div>';
    openModal('Add account', body, function (root) {
      root.querySelector('#accCancelBtn').addEventListener('click', closeModal);
      root.querySelector('#accSaveBtn').addEventListener('click', function () {
        const name = root.querySelector('#accNameInput').value.trim();
        const balance = parseFloat(root.querySelector('#accBalanceInput').value) || 0;
        if (!name) { showToast('Enter an account name'); return; }
        state.accounts.push({ id: uid('acc'), name: name, balance: balance, createdAt: Date.now() });
        saveState();
        closeModal();
        renderAccounts();
        showToast('Account added');
      });
    });
  }

  function openEditAccountNameModal(account) {
    const body = '' +
      '<div><label class="field-label">Account name</label><input class="text-input" id="editAccNameInput" value="' + escapeHtml(account.name) + '"></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" id="editAccCancelBtn">Cancel</button>' +
        '<button type="button" class="btn btn-primary" id="editAccSaveBtn">Save</button>' +
      '</div>';
    openModal('Edit account name', body, function (root) {
      root.querySelector('#editAccCancelBtn').addEventListener('click', closeModal);
      root.querySelector('#editAccSaveBtn').addEventListener('click', function () {
        const name = root.querySelector('#editAccNameInput').value.trim();
        if (!name) { showToast('Enter an account name'); return; }
        account.name = name;
        saveState();
        closeModal();
        renderAccounts();
        showToast('Account renamed');
      });
    });
  }

  function openTransferFundsModal(account) {
    const others = state.accounts.filter(function (a) { return a.id !== account.id; });
    if (others.length === 0) {
      showToast('Add another account to transfer funds');
      return;
    }
    const body = '' +
      '<p style="font-size:13px;color:var(--text-muted);">From <strong style="color:var(--text)">' + escapeHtml(account.name) + '</strong> (' + fmt(account.balance) + ')</p>' +
      '<div><label class="field-label">To account</label><select class="select-input" id="transferToSelect">' +
        others.map(function (a) { return '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="field-label">Amount</label><input type="number" step="0.01" min="0.01" class="text-input" id="transferAmountInput" placeholder="0.00"></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" id="transferCancelBtn">Cancel</button>' +
        '<button type="button" class="btn btn-primary" id="transferSaveBtn">Transfer</button>' +
      '</div>';
    openModal('Transfer funds', body, function (root) {
      root.querySelector('#transferCancelBtn').addEventListener('click', closeModal);
      root.querySelector('#transferSaveBtn').addEventListener('click', function () {
        const amount = parseFloat(root.querySelector('#transferAmountInput').value);
        const toId = root.querySelector('#transferToSelect').value;
        if (!amount || amount <= 0) { showToast('Enter a valid amount'); return; }
        const toAccount = getAccount(toId);
        account.balance -= amount;
        toAccount.balance += amount;
        saveState();
        closeModal();
        renderAccounts();
        showToast('Transferred ' + fmt(amount) + ' to ' + toAccount.name);
      });
    });
  }

  /* ---------------------------------------------------------
     Profile
  --------------------------------------------------------- */
  function renderProfile() {
    const nameInput = $('#profileNameInput');
    nameInput.value = state.settings.profileName || '';
    const avatarBtn = $('#profileAvatarBtn');
    const initialEl = $('#profileAvatarInitial');
    const initial = (state.settings.profileName || 'W').trim().slice(0, 1).toUpperCase() || 'W';
    if (state.settings.profilePhoto) {
      avatarBtn.style.backgroundImage = 'url(' + JSON.stringify(state.settings.profilePhoto) + ')';
      initialEl.hidden = true;
    } else {
      avatarBtn.style.backgroundImage = '';
      initialEl.hidden = false;
      initialEl.textContent = initial;
    }
    const d = parseISODate(state.settings.memberSince);
    $('#profileMemberSince').textContent = 'Member since ' + d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  $('#profileNameInput').addEventListener('input', function (e) {
    state.settings.profileName = e.target.value;
    saveState();
    if (!state.settings.profilePhoto) {
      $('#profileAvatarInitial').textContent = (e.target.value || 'W').trim().slice(0, 1).toUpperCase() || 'W';
    }
  });
  function openProfilePhotoPicker() {
    openImagePicker({
      title: 'Profile picture',
      currentUrl: state.settings.profilePhoto,
      onSelect: function (url) { state.settings.profilePhoto = url; saveState(); renderProfile(); },
      onRemove: state.settings.profilePhoto ? function () { state.settings.profilePhoto = null; saveState(); renderProfile(); } : null
    });
  }
  $('#profileAvatarBtn').addEventListener('click', openProfilePhotoPicker);
  $('#profileAvatarEditBtn').addEventListener('click', openProfilePhotoPicker);

  /* ---------------------------------------------------------
     Categories
  --------------------------------------------------------- */
  const openCategoryIds = new Set();

  function renderCategories() {
    const listEl = $('#categoriesList');
    listEl.innerHTML = state.categories.map(function (cat) {
      const isOpen = openCategoryIds.has(cat.id);
      return '' +
        '<div class="category-card">' +
          '<div class="category-head" data-id="' + cat.id + '">' +
            '<div class="category-thumb"' + (cat.icon ? ' style="background-image:url(' + JSON.stringify(cat.icon) + ')"' : '') + '>' + (cat.icon ? '' : escapeHtml(cat.name.slice(0, 1).toUpperCase())) + '</div>' +
            '<div class="category-head-main"><span class="category-name">' + escapeHtml(cat.name) + '</span></div>' +
            '<div class="category-head-actions">' +
              '<span class="category-count">' + cat.subcategories.length + '</span>' +
              '<button type="button" class="icon-btn" data-action="menu" data-id="' + cat.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><circle cx="12" cy="5" r="1.4"></circle><circle cx="12" cy="12" r="1.4"></circle><circle cx="12" cy="19" r="1.4"></circle></svg></button>' +
              '<svg class="chevron-toggle' + (isOpen ? ' is-open' : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M6 9l6 6 6-6"></path></svg>' +
            '</div>' +
          '</div>' +
          '<div class="subcategory-list' + (isOpen ? ' is-open' : '') + '" data-list-for="' + cat.id + '">' +
            cat.subcategories.map(function (s) {
              return '' +
                '<div class="subcategory-row">' +
                  '<div class="subcategory-thumb"' + (s.icon ? ' style="background-image:url(' + JSON.stringify(s.icon) + ')"' : '') + '>' + (s.icon ? '' : escapeHtml(s.name.slice(0, 1).toUpperCase())) + '</div>' +
                  '<span class="subcategory-name">' + escapeHtml(s.name) + '</span>' +
                  '<button type="button" class="icon-btn" data-action="sub-menu" data-cat="' + cat.id + '" data-sub="' + s.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><circle cx="12" cy="5" r="1.3"></circle><circle cx="12" cy="12" r="1.3"></circle><circle cx="12" cy="19" r="1.3"></circle></svg></button>' +
                '</div>';
            }).join('') +
            '<button type="button" class="add-subcat-btn" data-action="add-sub" data-id="' + cat.id + '">+ Add subcategory</button>' +
          '</div>' +
        '</div>';
    }).join('');

    Array.prototype.forEach.call(listEl.querySelectorAll('.category-head'), function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.icon-btn')) return;
        const id = el.getAttribute('data-id');
        if (openCategoryIds.has(id)) openCategoryIds.delete(id); else openCategoryIds.add(id);
        renderCategories();
      });
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('[data-action="menu"]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openCategoryMenu(getCategory(btn.getAttribute('data-id')));
      });
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('[data-action="sub-menu"]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const cat = getCategory(btn.getAttribute('data-cat'));
        const sub = getSubcategory(cat, btn.getAttribute('data-sub'));
        openSubcategoryMenu(cat, sub);
      });
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('[data-action="add-sub"]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openAddSubcategoryModal(getCategory(btn.getAttribute('data-id')));
      });
    });
  }

  function openCategoryMenu(cat) {
    openSheet(cat.name, [
      {
        label: 'Change photo', icon: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="10" r="1.4"></circle><path d="M21 16l-5-5-4 4-2-2-5 5"></path>',
        onClick: function () {
          openImagePicker({
            title: cat.name + ' photo', currentUrl: cat.icon,
            onSelect: function (url) { cat.icon = url; saveState(); renderCategories(); },
            onRemove: cat.icon ? function () { cat.icon = null; saveState(); renderCategories(); } : null
          });
        }
      },
      {
        label: 'Rename', icon: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>',
        onClick: function () { openRenameCategoryModal(cat); }
      },
      {
        label: 'Delete category', icon: '<path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M6 7l1 13h10l1-13"></path>', danger: true,
        onClick: function () { openDeleteCategoryFlow(cat); }
      }
    ]);
  }

  function openSubcategoryMenu(cat, sub) {
    openSheet(sub.name, [
      {
        label: 'Change photo', icon: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="10" r="1.4"></circle><path d="M21 16l-5-5-4 4-2-2-5 5"></path>',
        onClick: function () {
          openImagePicker({
            title: sub.name + ' photo', currentUrl: sub.icon,
            onSelect: function (url) { sub.icon = url; saveState(); renderCategories(); },
            onRemove: sub.icon ? function () { sub.icon = null; saveState(); renderCategories(); } : null
          });
        }
      },
      {
        label: 'Rename', icon: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>',
        onClick: function () { openRenameSubcategoryModal(cat, sub); }
      },
      {
        label: 'Delete subcategory', icon: '<path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M6 7l1 13h10l1-13"></path>', danger: true,
        onClick: function () { openDeleteSubcategoryFlow(cat, sub); }
      }
    ]);
  }

  $('#addCategoryBtn').addEventListener('click', function () {
    const body = '' +
      '<div><label class="field-label">Category name</label><input class="text-input" id="newCatNameInput" placeholder="e.g. Utilities"></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" id="newCatCancelBtn">Cancel</button>' +
        '<button type="button" class="btn btn-primary" id="newCatSaveBtn">Add</button>' +
      '</div>';
    openModal('Add category', body, function (root) {
      root.querySelector('#newCatCancelBtn').addEventListener('click', closeModal);
      root.querySelector('#newCatSaveBtn').addEventListener('click', function () {
        const name = root.querySelector('#newCatNameInput').value.trim();
        if (!name) { showToast('Enter a category name'); return; }
        state.categories.push({ id: uid('cat'), name: name, icon: null, subcategories: [] });
        saveState();
        closeModal();
        renderCategories();
        showToast('Category added');
      });
    });
  });

  function openRenameCategoryModal(cat) {
    const body = '' +
      '<div><label class="field-label">Category name</label><input class="text-input" id="renameCatInput" value="' + escapeHtml(cat.name) + '"></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" id="renameCatCancelBtn">Cancel</button>' +
        '<button type="button" class="btn btn-primary" id="renameCatSaveBtn">Save</button>' +
      '</div>';
    openModal('Rename category', body, function (root) {
      root.querySelector('#renameCatCancelBtn').addEventListener('click', closeModal);
      root.querySelector('#renameCatSaveBtn').addEventListener('click', function () {
        const name = root.querySelector('#renameCatInput').value.trim();
        if (!name) return;
        cat.name = name;
        saveState();
        closeModal();
        renderCategories();
      });
    });
  }

  function openRenameSubcategoryModal(cat, sub) {
    const body = '' +
      '<div><label class="field-label">Subcategory name</label><input class="text-input" id="renameSubInput" value="' + escapeHtml(sub.name) + '"></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" id="renameSubCancelBtn">Cancel</button>' +
        '<button type="button" class="btn btn-primary" id="renameSubSaveBtn">Save</button>' +
      '</div>';
    openModal('Rename subcategory', body, function (root) {
      root.querySelector('#renameSubCancelBtn').addEventListener('click', closeModal);
      root.querySelector('#renameSubSaveBtn').addEventListener('click', function () {
        const name = root.querySelector('#renameSubInput').value.trim();
        if (!name) return;
        sub.name = name;
        saveState();
        closeModal();
        renderCategories();
      });
    });
  }

  function openAddSubcategoryModal(cat) {
    const body = '' +
      '<div><label class="field-label">Subcategory name</label><input class="text-input" id="newSubNameInput" placeholder="e.g. Groceries"></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" id="newSubCancelBtn">Cancel</button>' +
        '<button type="button" class="btn btn-primary" id="newSubSaveBtn">Add</button>' +
      '</div>';
    openModal('Add subcategory to ' + cat.name, body, function (root) {
      root.querySelector('#newSubCancelBtn').addEventListener('click', closeModal);
      root.querySelector('#newSubSaveBtn').addEventListener('click', function () {
        const name = root.querySelector('#newSubNameInput').value.trim();
        if (!name) { showToast('Enter a subcategory name'); return; }
        cat.subcategories.push({ id: uid('sub'), name: name, icon: null });
        saveState();
        openCategoryIds.add(cat.id);
        closeModal();
        renderCategories();
        showToast('Subcategory added');
      });
    });
  }

  // Deleting a category or subcategory that still has transactions attached
  // offers a chance to move those transactions elsewhere first.
  function openDeleteCategoryFlow(cat) {
    const count = state.transactions.filter(function (t) { return t.categoryId === cat.id; }).length;
    if (count === 0) {
      openConfirm({
        title: 'Delete ' + cat.name + '?',
        message: 'This category has no transactions attached. It will be permanently removed.',
        confirmLabel: 'Delete', danger: true,
        onConfirm: function () {
          state.categories = state.categories.filter(function (c) { return c.id !== cat.id; });
          saveState();
          renderCategories();
          showToast('Category deleted');
        }
      });
      return;
    }
    const others = state.categories.filter(function (c) { return c.id !== cat.id; });
    const body = '' +
      '<p style="font-size:13.5px;color:var(--text-muted);line-height:1.5;">' + count + ' transaction' + (count === 1 ? '' : 's') + ' use' + (count === 1 ? 's' : '') + ' "' + escapeHtml(cat.name) + '". Move ' + (count === 1 ? 'it' : 'them') + ' to another category, or leave ' + (count === 1 ? 'it' : 'them') + ' uncategorized.</p>' +
      '<div><label class="field-label">Move to</label><select class="select-input" id="catTransferSelect">' +
        '<option value="">Leave uncategorized</option>' +
        others.map(function (c) { return '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" id="catDeleteCancelBtn">Cancel</button>' +
        '<button type="button" class="btn btn-danger" id="catDeleteConfirmBtn">Delete category</button>' +
      '</div>';
    openModal('Delete ' + cat.name, body, function (root) {
      root.querySelector('#catDeleteCancelBtn').addEventListener('click', closeModal);
      root.querySelector('#catDeleteConfirmBtn').addEventListener('click', function () {
        const target = root.querySelector('#catTransferSelect').value || null;
        state.transactions.forEach(function (t) {
          if (t.categoryId === cat.id) { t.categoryId = target; t.subcategoryId = null; }
        });
        state.categories = state.categories.filter(function (c) { return c.id !== cat.id; });
        saveState();
        closeModal();
        renderCategories();
        renderTransactions();
        showToast('Category deleted');
      });
    });
  }

  function openDeleteSubcategoryFlow(cat, sub) {
    const count = state.transactions.filter(function (t) { return t.categoryId === cat.id && t.subcategoryId === sub.id; }).length;
    if (count === 0) {
      openConfirm({
        title: 'Delete ' + sub.name + '?',
        message: 'This subcategory has no transactions attached. It will be permanently removed.',
        confirmLabel: 'Delete', danger: true,
        onConfirm: function () {
          cat.subcategories = cat.subcategories.filter(function (s) { return s.id !== sub.id; });
          saveState();
          renderCategories();
          showToast('Subcategory deleted');
        }
      });
      return;
    }
    const others = cat.subcategories.filter(function (s) { return s.id !== sub.id; });
    const body = '' +
      '<p style="font-size:13.5px;color:var(--text-muted);line-height:1.5;">' + count + ' transaction' + (count === 1 ? '' : 's') + ' use' + (count === 1 ? 's' : '') + ' "' + escapeHtml(sub.name) + '". Move ' + (count === 1 ? 'it' : 'them') + ' to another subcategory, or leave ' + (count === 1 ? 'it' : 'them') + ' at just "' + escapeHtml(cat.name) + '".</p>' +
      '<div><label class="field-label">Move to</label><select class="select-input" id="subTransferSelect">' +
        '<option value="">No subcategory</option>' +
        others.map(function (s) { return '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" id="subDeleteCancelBtn">Cancel</button>' +
        '<button type="button" class="btn btn-danger" id="subDeleteConfirmBtn">Delete subcategory</button>' +
      '</div>';
    openModal('Delete ' + sub.name, body, function (root) {
      root.querySelector('#subDeleteCancelBtn').addEventListener('click', closeModal);
      root.querySelector('#subDeleteConfirmBtn').addEventListener('click', function () {
        const target = root.querySelector('#subTransferSelect').value || null;
        state.transactions.forEach(function (t) {
          if (t.categoryId === cat.id && t.subcategoryId === sub.id) t.subcategoryId = target;
        });
        cat.subcategories = cat.subcategories.filter(function (s) { return s.id !== sub.id; });
        saveState();
        closeModal();
        renderCategories();
        renderTransactions();
        showToast('Subcategory deleted');
      });
    });
  }

  /* ---------------------------------------------------------
     Statistics
  --------------------------------------------------------- */
  $('#statsTypeToggle').addEventListener('click', function (e) {
    const btn = e.target.closest('.toggle-pill');
    if (!btn) return;
    statsType = btn.getAttribute('data-type');
    Array.prototype.forEach.call($$('.toggle-pill'), function (p) { p.classList.toggle('is-active', p === btn); });
    renderStatistics();
  });

  $('#statsFilterBtn').addEventListener('click', function () {
    openDateFilterModal('Filter statistics', statsFilter, function (preset, cs, ce) {
      statsFilter.preset = preset; statsFilter.customStart = cs; statsFilter.customEnd = ce;
      renderStatistics();
    });
  });

  $('#statsCategoryFilterBtn').addEventListener('click', openStatsCategoryFilterModal);

  function openStatsCategoryFilterModal() {
    const excluded = state.settings.statsExcludedCategoryIds;
    const html = '<div class="filter-checklist">' + state.categories.map(function (c) {
      const checked = excluded.indexOf(c.id) === -1;
      return '' +
        '<label class="filter-checklist-row">' +
          '<input type="checkbox" data-id="' + c.id + '"' + (checked ? ' checked' : '') + '>' +
          '<span>' + escapeHtml(c.name) + '</span>' +
        '</label>';
    }).join('') + '</div>' +
    '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="statsFilterAllBtn">Select all</button>' +
      '<button type="button" class="btn btn-primary" id="statsFilterApplyBtn">Apply</button>' +
    '</div>';
    openModal('Filter categories', html, function (root) {
      root.querySelector('#statsFilterAllBtn').addEventListener('click', function () {
        Array.prototype.forEach.call(root.querySelectorAll('input[type="checkbox"]'), function (cb) { cb.checked = true; });
      });
      root.querySelector('#statsFilterApplyBtn').addEventListener('click', function () {
        const newExcluded = [];
        Array.prototype.forEach.call(root.querySelectorAll('input[type="checkbox"]'), function (cb) {
          if (!cb.checked) newExcluded.push(cb.getAttribute('data-id'));
        });
        state.settings.statsExcludedCategoryIds = newExcluded;
        saveState();
        closeModal();
        renderStatistics();
      });
    });
  }

  function renderStatistics() {
    $('#statsFilterLabel').textContent = rangeLabel(statsFilter.preset, statsFilter.customStart, statsFilter.customEnd);
    const range = computeRange(statsFilter.preset, statsFilter.customStart, statsFilter.customEnd);
    const excluded = state.settings.statsExcludedCategoryIds;

    const sums = {};
    let total = 0;
    state.transactions.forEach(function (t) {
      if (t.type !== statsType) return;
      if (!inRange(t.date, range)) return;
      if (t.categoryId && excluded.indexOf(t.categoryId) > -1) return;
      const key = t.categoryId || 'none';
      sums[key] = (sums[key] || 0) + t.amount;
      total += t.amount;
    });

    const wrap = $('#pieChartWrap');
    const legend = $('#pieLegend');
    const emptyEl = $('#statsEmpty');

    const entries = Object.keys(sums).map(function (key) {
      return { key: key, name: (getCategory(key) && getCategory(key).name) || 'Uncategorized', value: sums[key] };
    }).sort(function (a, b) { return b.value - a.value; });

    if (entries.length === 0 || total === 0) {
      wrap.innerHTML = '';
      legend.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    wrap.innerHTML = buildDonutSvg(entries, total);
    legend.innerHTML = entries.map(function (e, i) {
      const pct = Math.round((e.value / total) * 100);
      return '' +
        '<div class="legend-row">' +
          '<span class="legend-dot" style="background:' + CHART_PALETTE[i % CHART_PALETTE.length] + '"></span>' +
          '<span class="legend-name">' + escapeHtml(e.name) + ' (' + pct + '%)</span>' +
          '<span class="legend-value">' + fmt(e.value) + '</span>' +
        '</div>';
    }).join('');
  }

  function buildDonutSvg(entries, total) {
    const r = 68, cx = 90, cy = 90, sw = 26;
    const circumference = 2 * Math.PI * r;
    let cumulative = 0;
    let circles = '';
    entries.forEach(function (e, i) {
      const dash = (e.value / total) * circumference;
      circles += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + CHART_PALETTE[i % CHART_PALETTE.length] + '" stroke-width="' + sw + '" stroke-dasharray="' + dash + ' ' + (circumference - dash) + '" stroke-dashoffset="' + (-cumulative) + '"></circle>';
      cumulative += dash;
    });
    return '' +
      '<svg viewBox="0 0 180 180" width="200" height="200">' +
        '<g transform="rotate(-90 90 90)">' + circles + '</g>' +
        '<text x="90" y="86" text-anchor="middle" font-family="Poppins, sans-serif" font-size="11" fill="#8C8375" font-weight="500">Total</text>' +
        '<text x="90" y="104" text-anchor="middle" font-family="Poppins, sans-serif" font-size="15" fill="#332F2A" font-weight="700">' + escapeHtml(fmt(total)) + '</text>' +
      '</svg>';
  }

  /* ---------------------------------------------------------
     Settings
  --------------------------------------------------------- */
  function renderSettings() {
    $('#settingsCurrencyValue').textContent = state.settings.currency;
    const palette = PALETTES.find(function (p) { return p.key === state.settings.paletteKey; }) || PALETTES[0];
    $('#settingsPaletteValue').textContent = palette.name;
    $('#settingsPaletteDot').style.background = palette.accent;
  }
  $('#settingsCurrencyRow').addEventListener('click', openCurrencyModal);
  $('#resetDataBtn').addEventListener('click', function () {
    openConfirm({
      title: 'Reset all data',
      message: 'This deletes every account, transaction, and category permanently. This cannot be undone.',
      confirmLabel: 'Reset', danger: true,
      onConfirm: function () {
        state = defaultState();
        saveState();
        txLimit = 20;
        renderAll();
        applyPalette(state.settings.paletteKey);
        showToast('All data has been reset');
      }
    });
  });

  /* ---------------------------------------------------------
     Currency (header quick-switch + settings)
  --------------------------------------------------------- */
  function openCurrencyModal() {
    const body = '<div class="currency-option-list" id="currencyOptionList">' +
      CURRENCIES.map(function (c) {
        return '<button type="button" class="currency-option' + (c.code === state.settings.currency ? ' is-selected' : '') + '" data-code="' + c.code + '">' +
          '<span>' + c.symbol + ' ' + escapeHtml(c.name) + '</span><span class="currency-option-code">' + c.code + '</span>' +
        '</button>';
      }).join('') +
    '</div>';
    openModal('Choose currency', body, function (root) {
      Array.prototype.forEach.call(root.querySelectorAll('.currency-option'), function (btn) {
        btn.addEventListener('click', function () {
          state.settings.currency = btn.getAttribute('data-code');
          saveState();
          closeModal();
          renderAll();
          showToast('Currency set to ' + state.settings.currency);
        });
      });
    });
  }
  $('#currencyBtn').addEventListener('click', openCurrencyModal);

  function updateCurrencyBtnLabel() {
    const cur = CURRENCIES.find(function (c) { return c.code === state.settings.currency; }) || CURRENCIES[0];
    $('#currencyBtnLabel').textContent = cur.symbol + ' ' + cur.code;
  }

  /* ---------------------------------------------------------
     Init
  --------------------------------------------------------- */
  function renderAll() {
    updateCurrencyBtnLabel();
    renderTransactions();
    renderAccounts();
    renderMoreActiveSub();
  }

  renderAll();
  applyPalette(state.settings.paletteKey);
  switchTab('transactions');

  /* ---------------------------------------------------------
     Service worker
  --------------------------------------------------------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline support unavailable */ });
    });
  }
})();
