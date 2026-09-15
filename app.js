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

  /* ---------------------------------------------------------
     State
  --------------------------------------------------------- */
  function defaultState() {
    return {
      accounts: [
        { id: uid('acc'), name: 'Cash', balance: 0 }
      ],
      transactions: [],
      categories: [
        { id: uid('cat'), name: 'Food', subcategories: [] },
        { id: uid('cat'), name: 'Transportation', subcategories: [] },
        { id: uid('cat'), name: 'Shopping', subcategories: [] }
      ],
      settings: {
        currency: 'PHP',
        profileName: '',
        memberSince: todayISO()
      }
    };
  }

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed.accounts || !parsed.categories) return defaultState();
      return parsed;
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
    applyTransaction(tx);
    saveState();
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
    let borrowed = 0, repaid = 0;
    state.transactions.forEach(function (t) {
      if (t.type === 'borrowed') borrowed += t.amount;
      if (t.type === 'repayment') repaid += t.amount;
    });
    const debt = Math.max(0, borrowed - repaid);

    const range = computeRange(txFilter.preset, txFilter.customStart, txFilter.customEnd);
    let inflow = 0, outflow = 0;
    state.transactions.forEach(function (t) {
      if (!inRange(t.date, range)) return;
      if (TYPE_META[t.type].direction === 'in') inflow += t.amount;
      else outflow += t.amount;
    });

    $('#statNetWorth').textContent = fmt(netWorth);
    $('#statDebt').textContent = fmt(debt);
    $('#statInflow').textContent = fmt(inflow);
    $('#statOutflow').textContent = fmt(outflow);
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
      const icon = meta.direction === 'in' ? ICON_IN : ICON_OUT;
      const sign = meta.direction === 'in' ? '+' : '-';
      html += '' +
        '<div class="tx-item type-' + t.type + '" data-id="' + t.id + '">' +
          '<div class="tx-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg>' +
          '</div>' +
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

  function openTransactionModal(existingTx) {
    if (state.accounts.length === 0) {
      showToast('Add an account first');
      openAccountModal(null);
      return;
    }
    const isEdit = !!existingTx;
    const initial = existingTx || {
      amount: '', type: 'expense', date: todayISO(),
      accountId: state.accounts[0].id, categoryId: state.categories[0].id,
      subcategoryId: null, note: ''
    };

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

      Array.prototype.forEach.call(root.querySelectorAll('.type-chip'), function (chip) {
        chip.addEventListener('click', function () {
          selectedType = chip.getAttribute('data-type');
          Array.prototype.forEach.call(root.querySelectorAll('.type-chip'), function (c) { c.classList.toggle('is-active', c === chip); });
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

        const data = { amount: amount, type: selectedType, date: date, accountId: accountId, categoryId: categoryId, subcategoryId: subcategoryId, note: note };
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

    listEl.innerHTML = state.accounts.map(function (a) {
      return '' +
        '<div class="account-card" data-id="' + a.id + '">' +
          '<div class="account-emblem">' + escapeHtml(a.name.slice(0, 1).toUpperCase()) + '</div>' +
          '<div class="account-info">' +
            '<div class="account-name">' + escapeHtml(a.name) + '</div>' +
            '<div class="account-balance">' + fmt(a.balance) + '</div>' +
          '</div>' +
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
        state.accounts.push({ id: uid('acc'), name: name, balance: balance });
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
    $('#profileAvatar').textContent = (state.settings.profileName || 'W').trim().slice(0, 1).toUpperCase();
    const d = parseISODate(state.settings.memberSince);
    $('#profileMemberSince').textContent = 'Member since ' + d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  $('#profileNameInput').addEventListener('input', function (e) {
    state.settings.profileName = e.target.value;
    saveState();
    $('#profileAvatar').textContent = (e.target.value || 'W').trim().slice(0, 1).toUpperCase() || 'W';
  });

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
            '<span class="category-name">' + escapeHtml(cat.name) + '</span>' +
            '<div class="category-head-actions">' +
              '<span class="category-count">' + cat.subcategories.length + '</span>' +
              '<button type="button" class="icon-btn" data-action="edit" data-id="' + cat.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg></button>' +
              '<button type="button" class="icon-btn" data-action="delete" data-id="' + cat.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M6 7l1 13h10l1-13"></path></svg></button>' +
              '<svg class="chevron-toggle' + (isOpen ? ' is-open' : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M6 9l6 6 6-6"></path></svg>' +
            '</div>' +
          '</div>' +
          '<div class="subcategory-list' + (isOpen ? ' is-open' : '') + '" data-list-for="' + cat.id + '">' +
            cat.subcategories.map(function (s) {
              return '<div class="subcategory-row"><span>' + escapeHtml(s.name) + '</span><button type="button" class="icon-btn" data-action="delete-sub" data-cat="' + cat.id + '" data-sub="' + s.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div>';
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
    Array.prototype.forEach.call(listEl.querySelectorAll('[data-action="edit"]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openRenameCategoryModal(getCategory(btn.getAttribute('data-id')));
      });
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('[data-action="delete"]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const cat = getCategory(btn.getAttribute('data-id'));
        openConfirm({
          title: 'Delete ' + cat.name + '?',
          message: 'Transactions using this category will show as Uncategorized.',
          confirmLabel: 'Delete', danger: true,
          onConfirm: function () {
            state.categories = state.categories.filter(function (c) { return c.id !== cat.id; });
            saveState();
            renderCategories();
            showToast('Category deleted');
          }
        });
      });
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('[data-action="delete-sub"]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const cat = getCategory(btn.getAttribute('data-cat'));
        cat.subcategories = cat.subcategories.filter(function (s) { return s.id !== btn.getAttribute('data-sub'); });
        saveState();
        renderCategories();
      });
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('[data-action="add-sub"]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openAddSubcategoryModal(getCategory(btn.getAttribute('data-id')));
      });
    });
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
        state.categories.push({ id: uid('cat'), name: name, subcategories: [] });
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
        cat.subcategories.push({ id: uid('sub'), name: name });
        saveState();
        openCategoryIds.add(cat.id);
        closeModal();
        renderCategories();
        showToast('Subcategory added');
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

  function renderStatistics() {
    $('#statsFilterLabel').textContent = rangeLabel(statsFilter.preset, statsFilter.customStart, statsFilter.customEnd);
    const range = computeRange(statsFilter.preset, statsFilter.customStart, statsFilter.customEnd);

    const sums = {};
    let total = 0;
    state.transactions.forEach(function (t) {
      if (t.type !== statsType) return;
      if (!inRange(t.date, range)) return;
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
