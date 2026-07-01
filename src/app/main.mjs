import {
  buildCalendarMonth,
  buildCategoryCatalog,
  buildCategoryBreakdown,
  buildCharacterPrompt,
  buildScopedSummary,
  buildSummary,
  categories,
  createDefaultLedgerState,
  defaultEvaluationPrompt,
  formatMoney,
  groupEntriesByDay,
  kinds,
  parseCharacterCard,
  parseCharacterCardFromPngBytes,
  parseWorldBook,
  removeBuiltInCharacters,
  removeBuiltInEvaluations,
  selectWorldBookEntries,
} from '../domain/ledger-core.mjs';
import { applyEntryToAccounts, buildFeeEntryForTransfer, createDefaultAccounts, summarizeAccountFlow } from '../domain/account-core.mjs';
import { buildAchievements, buildCharacterAchievementComments } from '../domain/achievement-core.mjs';
import { buildBudgetSummary, getCategoryBudgetStatus } from '../domain/budget-core.mjs';
import { inferCategoryByKeywords, normalizeKeywordList } from '../domain/category-rules.mjs';
import { findDuplicateCandidates } from '../domain/duplicate-core.mjs';
import { buildPendingSummary, createPendingItem, summarizePendingItem } from '../domain/pending-core.mjs';

const storageKey = 'standalone-ledger-v2';
const defaultState = createDefaultLedgerState();

const themeOptions = [
  { id: 'pastel', name: '奶油手绘' },
  { id: 'guofeng', name: '古风手札' },
  { id: 'status-terminal', name: '状态终端' },
  { id: 'alcheris-pixel', name: '阿尔切利斯像素' },
];

const fontOptions = [
  { id: 'system', name: '默认清爽' },
  { id: 'rounded', name: '圆润手账' },
  { id: 'serif', name: '书卷宋体' },
  { id: 'clean', name: '利落黑体' },
  { id: 'mono', name: '数字等宽' },
];

const allThemeClasses = [
  'theme-pastel',
  'theme-gothic',
  'theme-guofeng',
  'theme-celtic-paladin',
  'theme-status-terminal',
  'theme-alcheris-pixel',
];
const allFontClasses = fontOptions
  .filter((item) => item.id !== 'system')
  .map((item) => `font-${item.id}`);
const scopeLabels = {
  day: '当天',
  week: '本周',
  month: '当月',
  year: '当年',
  all: '总计',
};

const viewLabels = {
  list: '明细',
  pie: '饼图',
  bar: '条形',
};

const defaultPaymentAppWhitelist = ['com.tencent.mm', 'com.eg.android.AlipayGphone'];
const defaultPaymentKeywords = ['支付成功', '付款成功', '已支付', '支付', '付款', '扣款', '交易成功', '收款', '零钱', '银行卡', '¥', '￥', '元'];

let state = loadState();
let activePage = state.settings.defaultPage || 'record';
let activeMinePanel = '';
let activeContactId = '';
let detailScope = 'day';
let detailView = 'list';
let selectedDate = Date.now();
let calendarCursor = selectedDate;
let recordDraft = createDraft('expense', activeCategories());
let themeSheetOpen = false;
let expandedEvaluationIds = new Set();
let paymentSyncInFlight = false;
let paymentSettingsLoaded = false;
let installedApps = [];
let installedAppQuery = '';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const savedCharacters = removeBuiltInCharacters(Array.isArray(saved.characters) ? saved.characters : []);
    const savedEntries = Array.isArray(saved.entries)
      ? saved.entries.map((entry) => ({ ...entry, evaluations: removeBuiltInEvaluations(entry.evaluations || []) }))
      : [];
    const savedChats = Array.isArray(saved.chatMessages)
      ? saved.chatMessages.filter((message) => !String(message.id || '').includes('default-'))
      : [];
    return {
      ...defaultState,
      ...saved,
      settings: { ...defaultState.settings, ...(saved.settings || {}) },
      userProfile: { ...defaultState.userProfile, ...(saved.userProfile || {}) },
      characters: savedCharacters.map((character) => ({
        ...character,
        worldBooks: Array.isArray(character.worldBooks) ? character.worldBooks : [],
      })),
      worldBooks: Array.isArray(saved.worldBooks) ? saved.worldBooks : [],
      chatMessages: savedChats,
      entries: savedEntries,
      categoryOverrides: Array.isArray(saved.categoryOverrides) ? saved.categoryOverrides : [],
      budgets: {
        ...defaultState.budgets,
        ...(saved.budgets || {}),
        categoryLimits: Array.isArray(saved.budgets?.categoryLimits) ? saved.budgets.categoryLimits : [],
      },
      accounts: Array.isArray(saved.accounts) && saved.accounts.length ? saved.accounts : createDefaultAccounts(),
      pendingItems: Array.isArray(saved.pendingItems) ? saved.pendingItems : [],
      insightPreset: String(saved.insightPreset || defaultState.insightPreset || ''),
      lastInsight: saved.lastInsight || null,
    };
  } catch {
    return { ...createDefaultLedgerState(), accounts: createDefaultAccounts() };
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function startOfMonth(time) {
  const date = new Date(time);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function shiftMonth(time, amount) {
  const date = new Date(time);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function detailReferenceTime() {
  return ['day', 'week'].includes(detailScope) ? selectedDate : calendarCursor;
}

function activeCategories() {
  return buildCategoryCatalog(state.categoryOverrides);
}

function createDraft(kind, catalog = categories) {
  const firstCategory = catalog.find((category) => category.kind === kind);
  const accounts = state?.accounts?.length ? state.accounts : createDefaultAccounts();
  return {
    kind,
    category: firstCategory?.name || '',
    amountBuffer: '',
    note: '',
    characterName: '',
    accountId: accounts[0]?.id || '',
    fromAccountId: accounts.find((account) => account.id === 'bank')?.id || accounts[0]?.id || '',
    toAccountId: accounts.find((account) => account.id === 'wechat')?.id || accounts[1]?.id || '',
    feeAmount: '',
    pendingItemId: '',
    autoCategorySource: '',
    categoryManuallySelected: false,
  };
}

function makeId() {
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCategory(name) {
  return activeCategories().find((category) => category.name === name) || activeCategories()[0] || categories[0];
}

function escapeHtml(text) {
  return String(text || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

const iconStroke = 'stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const categoryIconSvgs = {
  food: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M9 5v10M13 5v10M11 5v22M21 5c3 2 4 6 2 10-1 2-3 3-5 3V5"/></svg>`,
  traffic: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M7 18l3-8h12l3 8v6H7v-6zM10 24v3M22 24v3M10 18h12M11 14h10"/><circle cx="11" cy="21" r="1.6" fill="currentColor"/><circle cx="21" cy="21" r="1.6" fill="currentColor"/></svg>`,
  game: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M8 13h16a4 4 0 0 1 4 4v5a4 4 0 0 1-7 2l-2-2h-6l-2 2a4 4 0 0 1-7-2v-5a4 4 0 0 1 4-4zM10 19h6M13 16v6"/><circle cx="22" cy="18" r="1.4" fill="currentColor"/><circle cx="25" cy="21" r="1.4" fill="currentColor"/></svg>`,
  gift: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M6 13h20v14H6zM16 13v14M5 13v-4h22v4M12 9c-2-1-3-4-1-5 3-1 5 5 5 5s2-6 5-5c2 1 1 4-1 5"/></svg>`,
  shopping: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M8 12h16l-2 15H10L8 12zM12 12a4 4 0 0 1 8 0"/></svg>`,
  home: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M5 16L16 6l11 10M9 15v12h14V15M13 27v-7h6v7"/></svg>`,
  medical: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="9" width="18" height="18" rx="4" ${iconStroke}/><path ${iconStroke} d="M16 13v10M11 18h10M12 9V6h8v3"/></svg>`,
  study: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M7 8h9v18H7a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3zM16 8h9a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-9V8zM16 8v18"/></svg>`,
  social: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M8 12h16v15H8zM16 12v15M8 17h16M12 12c-2-2-1-5 2-5 2 0 2 5 2 5s0-5 2-5c3 0 4 3 2 5"/></svg>`,
  other: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="10" cy="16" r="2.2" fill="currentColor"/><circle cx="16" cy="16" r="2.2" fill="currentColor"/><circle cx="22" cy="16" r="2.2" fill="currentColor"/></svg>`,
  salary: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="9" width="20" height="15" rx="3" ${iconStroke}/><path ${iconStroke} d="M10 14h12M10 19h7"/><circle cx="23" cy="20" r="1.5" fill="currentColor"/></svg>`,
  parttime: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M9 10h14v17H9zM12 10V6h8v4M13 16h6M13 21h4"/></svg>`,
  refund: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M20 9h-8l-5 5 5 5h8a5 5 0 0 1 0 10h-5"/></svg>`,
  redpacket: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M8 7h16v20H8zM8 12l8 5 8-5M13 21h6"/></svg>`,
  income: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10" ${iconStroke}/><path ${iconStroke} d="M16 10v12M10 16h12"/></svg>`,
  lend: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M6 16h18M18 10l6 6-6 6M8 23h8"/></svg>`,
  repay: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M26 16H8M14 10l-6 6 6 6M16 23h8"/></svg>`,
  transfer: `<svg viewBox="0 0 32 32" aria-hidden="true"><path ${iconStroke} d="M7 11h16M17 6l6 5-6 5M25 21H9M15 16l-6 5 6 5"/></svg>`,
};

function renderCategoryIcon(icon) {
  const key = String(icon || '').trim();
  return categoryIconSvgs[key] || `<span class="icon-text">${escapeHtml(key.slice(0, 2) || '+')}</span>`;
}

function renderAvatar(character, className = 'contact-avatar') {
  const avatar = character.avatar || '';
  const name = character.name || character.characterName || character.sender || '';
  if (/^data:image\//.test(avatar) || /^https?:\/\//.test(avatar)) {
    return `<div class="${className} image-avatar"><img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" /></div>`;
  }
  return `<div class="${className}">${escapeHtml(avatar || name.slice(0, 1) || '角')}</div>`;
}

function setPage(pageName) {
  activePage = pageName;
  render();
}

function updateTheme() {
  document.body.classList.remove(...allThemeClasses, ...allFontClasses, 'dark');
  const theme = themeOptions.some((item) => item.id === state.settings.theme)
    ? state.settings.theme
    : 'pastel';
  document.body.classList.add(`theme-${theme}`);
  const font = fontOptions.some((item) => item.id === state.settings.fontFamily)
    ? state.settings.fontFamily
    : 'system';
  if (font !== 'system') document.body.classList.add(`font-${font}`);
}

function renderShell() {
  $('#todayText').textContent = new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  $$('.page').forEach((page) => page.classList.toggle('active', page.id === `${activePage}Page`));
  $$('.bottom-nav button').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === activePage);
  });
  $$('#detailScopeTabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.detailScope === detailScope);
  });
  $$('#detailViewTabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.detailView === detailView);
  });
  renderThemeSheet();
}

function renderThemeSheet() {
  $('#themeSheet').classList.toggle('active', themeSheetOpen);
  $('#themeSheet').setAttribute('aria-hidden', themeSheetOpen ? 'false' : 'true');
  const currentTheme = themeOptions.some((item) => item.id === state.settings.theme)
    ? state.settings.theme
    : 'pastel';
  $$('[data-theme-choice]').forEach((button) => {
    button.classList.toggle('active', button.dataset.themeChoice === currentTheme);
  });
  if ($('#fontSelect')) {
    $('#fontSelect').innerHTML = fontOptions
      .map((font) => `<option value="${escapeHtml(font.id)}">${escapeHtml(font.name)}</option>`)
      .join('');
    $('#fontSelect').value = fontOptions.some((item) => item.id === state.settings.fontFamily)
      ? state.settings.fontFamily
      : 'system';
  }
}

function setLedgerTheme(themeId) {
  if (!themeOptions.some((theme) => theme.id === themeId)) return;
  state.settings = { ...state.settings, theme: themeId };
  themeSheetOpen = false;
  saveState();
  render();
}

function setLedgerFont(fontId) {
  if (!fontOptions.some((font) => font.id === fontId)) return;
  state.settings = { ...state.settings, fontFamily: fontId };
  saveState();
  render();
}

function enabledCharacters() {
  return state.characters.filter((character) => character.enabled);
}

function renderEvaluate() {
  const participants = enabledCharacters();
  const entryCards = state.entries
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12)
    .map(renderEvaluationEntry);
  $('#evaluationFeed').innerHTML = entryCards.length
    ? entryCards.join('')
    : `<p class="empty">${participants.length ? '先记一笔账，角色们会在这里一起评账。' : '还没有角色。去“我的 > 角色通讯录”导入角色卡。'}</p>`;
}

function renderEvaluationEntry(entry) {
  const messages = Array.isArray(entry.evaluations) ? entry.evaluations : [];
  const isCollapsed = messages.length > 0 && !expandedEvaluationIds.has(entry.id);
  const visibleMessages = isCollapsed ? [] : messages;
  const status = entry.evaluationStatus || (messages.length ? '' : 'no-character');
  const statusText = {
    pending: '已保存，正在让角色自动评账。',
    'api-missing': '已保存。配置 API 后，启用的角色会自动评账。',
    failed: '评账失败，可以检查 API 设置后再试。',
    'no-character': '已保存。导入并启用角色后，后续账单会自动评账。',
  }[status] || '';
  return `
    <article class="ledger-thread">
      ${renderEntry(entry)}
      <div class="bubble-stack">
        ${messages.length ? visibleMessages.map((message) => `
          <div class="role-bubble">
            ${renderAvatar({ avatar: message.avatar, characterName: message.characterName }, 'bubble-avatar')}
            <div>
              <b>${escapeHtml(message.characterName)}</b>
              <p>${escapeHtml(message.content)}</p>
            </div>
          </div>
        `).join('') : `<p class="empty">${escapeHtml(statusText)}</p>`}
        ${messages.length > 0 ? `
          <button class="evaluation-toggle" type="button" data-toggle-evaluation="${escapeHtml(entry.id)}">
            ${isCollapsed ? `展开 ${messages.length} 条角色短评` : '收起角色短评'}
          </button>
        ` : ''}
      </div>
    </article>
  `;
}

function toggleEvaluationCollapse(entryId) {
  if (expandedEvaluationIds.has(entryId)) {
    expandedEvaluationIds.delete(entryId);
  } else {
    expandedEvaluationIds.add(entryId);
  }
  renderEvaluate();
}

function renderChatMessage(message) {
  return `
    <article class="chat-line ${message.type === 'user' ? 'user' : ''}">
      ${message.type === 'user'
        ? renderAvatar({ avatar: '我', sender: message.sender }, 'bubble-avatar')
        : renderAvatar({ avatar: message.avatar, sender: message.sender }, 'bubble-avatar')}
      <div>
        <b>${escapeHtml(message.sender)}</b>
        <p>${escapeHtml(message.content)}</p>
      </div>
    </article>
  `;
}

function renderOverview() {
  const summary = buildSummary(state.entries, calendarCursor);
  const budget = buildBudgetSummary(state.entries, state.budgets, calendarCursor);
  const pending = buildPendingSummary(state.pendingItems);
  $('#monthExpense').textContent = formatMoney(summary.monthExpense);
  $('#monthIncome').textContent = formatMoney(summary.monthIncome);
  $('#monthBalance').textContent = formatMoney(summary.balance);
  $('#overviewExpense').textContent = formatMoney(summary.monthExpense);
  $('#overviewIncome').textContent = formatMoney(summary.monthIncome);
  $('#overviewCount').textContent = String(summary.month.length);
  $('#budgetRemaining').textContent = budget.remaining === null ? '未设置' : formatMoney(budget.remaining);
  $('#pendingSummary').textContent = `${pending.openCount} 项`;
  renderCalendar(summary, calendarCursor);
}

function renderDetails() {
  const showingChart = detailView !== 'list';
  const referenceTime = detailReferenceTime();
  const summary = buildScopedSummary(state.entries, detailScope, referenceTime);
  const budget = buildBudgetSummary(state.entries, state.budgets, referenceTime);
  const pending = buildPendingSummary(state.pendingItems);
  $('#detailCount').textContent = `${scopeLabels[detailScope]} · ${viewLabels[detailView]} · ${summary.entries.length} 笔记录`;
  $('#detailTitle').textContent = '明细';
  $('#detailStats').innerHTML = [
    `<span>支出 <b>${formatMoney(summary.expense)}</b></span>`,
    `<span>收入 <b>${formatMoney(summary.income)}</b></span>`,
    `<span>结余 <b>${formatMoney(summary.income - summary.expense)}</b></span>`,
    `<span>预算 <b>${budget.remaining === null ? '未设置' : formatMoney(budget.remaining)}</b></span>`,
    `<span>待结清 <b>${pending.openCount} 项</b></span>`,
  ].join('');
  $('#entryGroups').classList.toggle('hidden', showingChart);
  $('#detailChartPanel').classList.toggle('hidden', !showingChart);
  $('#detailChartPanel').classList.toggle('bar-view', detailView === 'bar');
  if (showingChart) {
    renderCharts(detailScope, referenceTime, detailView);
    return;
  }
  const groups = groupEntriesByDay(summary.entries, referenceTime);
  $('#entryGroups').innerHTML = groups.length
    ? groups.map(renderDayGroup).join('')
    : '<p class="empty">还没有账单。点底部“记账”开始第一笔。</p>';
}

function renderCalendar(summary, now = Date.now()) {
  const date = new Date(now);
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  $('#calendarMonthTitle').textContent = `${date.getMonth() + 1}月`;
  $('#calendarRange').textContent = `${monthStart.getMonth() + 1}月${monthStart.getDate()}日 - ${monthEnd.getMonth() + 1}月${monthEnd.getDate()}日`;
  $('#calendarGrid').innerHTML = buildCalendarMonth(state.entries, now).map((day) => {
    const amount = day.expense ? `-${Math.round(day.expense)}` : day.income ? `+${Math.round(day.income)}` : '+0';
    const isToday = isSameDay(day.time, Date.now());
    const isSelected = isSameDay(day.time, selectedDate);
    return `
      <button type="button" class="calendar-day ${day.isCurrentMonth ? '' : 'muted'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-calendar-day="${day.time}">
        <span>${day.day}</span>
        <small>${amount}</small>
        ${day.entryCount ? '<i></i>' : ''}
      </button>
    `;
  }).join('');
}

function renderDayGroup(group) {
  const expense = group.entries
    .filter((entry) => entry.kind === 'expense')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const income = group.entries
    .filter((entry) => entry.kind === 'income')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const summaryText = [
    expense ? `支出 ${formatMoney(expense)}` : '',
    income ? `收入 ${formatMoney(income)}` : '',
  ].filter(Boolean).join(' · ');
  return `
    <section class="day-group">
      <div class="day-head">
        <span>${escapeHtml(group.label)}</span>
        <span>${summaryText || '无收支'}</span>
      </div>
      ${group.entries.map(renderEntry).join('')}
    </section>
  `;
}

function renderEntry(entry) {
  const category = getCategory(entry.category);
  const time = new Date(entry.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const amountPrefix = entry.kind === 'income' ? '+' : entry.kind === 'expense' ? '-' : '';
  return `
    <article class="entry-card">
      <button class="delete-entry" type="button" data-delete="${entry.id}" aria-label="删除账单">×</button>
      <div class="entry-icon" style="background:${category.color}">${renderCategoryIcon(category.icon)}</div>
      <div class="entry-info">
        <h3>${escapeHtml(entry.title || entry.category)}</h3>
        <p>${time} · ${kinds[entry.kind] || entry.kind} · ${escapeHtml(entry.category)}</p>
        ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}
      </div>
      <strong class="entry-amount ${entry.kind}">${amountPrefix}${formatMoney(entry.amount)}</strong>
      ${entry.characterName ? `<div class="reply"><b>${escapeHtml(entry.characterName)}：</b>${escapeHtml(entry.roleReply || '还没有短评。')}</div>` : ''}
    </article>
  `;
}

function renderCharts(scope = 'month', now = calendarCursor, view = detailView) {
  const summary = buildScopedSummary(state.entries, scope, now);
  const rows = buildCategoryBreakdown(state.entries, scope, now, activeCategories());
  $('.detail-chart-panel .metric-label').textContent = `${scopeLabels[scope] || '当月'}支出`;
  $('#chartExpense').textContent = formatMoney(summary.expense);
  $('#chartIncome').textContent = formatMoney(summary.income);
  $('#pieChart').classList.toggle('hidden', view === 'bar');
  renderPie(rows);
  renderRanking(rows);
}

function renderPie(rows) {
  if (!rows.length) {
    $('#pieChart').style.background = '#e8dfd1';
    return;
  }
  let cursor = 0;
  const segments = rows.map((row) => {
    const start = cursor;
    cursor += row.percent;
    return `${row.color} ${start}% ${cursor}%`;
  });
  $('#pieChart').style.background = `conic-gradient(${segments.join(', ')})`;
}

function renderRanking(rows) {
  const max = rows[0]?.amount || 1;
  $('#categoryRanking').innerHTML = rows.length
    ? rows.map((row) => `
      <div class="rank-row">
        <div class="entry-icon" style="background:${row.color}">${renderCategoryIcon(row.icon)}</div>
        <div>
          <h3>${escapeHtml(row.name)}</h3>
          <div class="rank-track"><div class="rank-fill" style="width:${Math.max(8, (row.amount / max) * 100)}%;background:${row.color}"></div></div>
        </div>
        <strong>${formatMoney(row.amount)}</strong>
      </div>
    `).join('')
    : '<p class="empty">这个周期还没有支出分类。</p>';
}

function renderRecord() {
  const catalog = activeCategories();
  const accounts = state.accounts.length ? state.accounts : createDefaultAccounts();
  if (!catalog.some((category) => category.kind === recordDraft.kind && category.name === recordDraft.category)) {
    recordDraft.category = catalog.find((category) => category.kind === recordDraft.kind)?.name || '';
  }
  $$('#recordKindTabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.kind === recordDraft.kind);
  });
  const amount = Number(recordDraft.amountBuffer || 0);
  $('#amountDisplay').textContent = formatMoney(amount);
  const budget = buildBudgetSummary(state.entries, state.budgets, Date.now());
  const categoryBudget = getCategoryBudgetStatus(state.entries, state.budgets, recordDraft.category, Date.now());
  $('#budgetHint').textContent = recordDraft.kind === 'expense'
    ? [
      budget.remaining === null ? '未设置本月总预算。' : `本月已花 ${formatMoney(budget.monthlyExpense)}，剩余 ${formatMoney(budget.remaining)}。`,
      categoryBudget.remaining === null ? '' : `${recordDraft.category} 剩余 ${formatMoney(categoryBudget.remaining)}。`,
    ].filter(Boolean).join(' ')
    : '预算只统计支出；收入和转账不会算作消费。';
  $('#categoryGrid').innerHTML = catalog
    .filter((category) => category.kind === recordDraft.kind)
    .map((category) => `
      <button class="category-card ${category.name === recordDraft.category ? 'active' : ''}" type="button" data-category="${category.name}">
        <span class="category-icon" style="background:${category.color}">${renderCategoryIcon(category.icon)}</span>
        <span>${escapeHtml(category.name)}</span>
      </button>
    `).join('');
  if ($('#noteInput').value !== recordDraft.note) $('#noteInput').value = recordDraft.note;
  const accountOptions = accounts.map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)} · ${formatMoney(account.balance || 0)}</option>`).join('');
  $('#accountSelect').innerHTML = accountOptions;
  $('#fromAccountSelect').innerHTML = accountOptions;
  $('#toAccountSelect').innerHTML = accountOptions;
  $('#accountSelect').value = recordDraft.accountId || accounts[0]?.id || '';
  $('#fromAccountSelect').value = recordDraft.fromAccountId || accounts[0]?.id || '';
  $('#toAccountSelect').value = recordDraft.toAccountId || accounts[1]?.id || accounts[0]?.id || '';
  $('#feeAmountInput').value = recordDraft.feeAmount || '';
  $('#accountSelectWrap').classList.toggle('hidden', recordDraft.kind === 'transfer');
  $('#transferFields').classList.toggle('active', recordDraft.kind === 'transfer');
  const openPendingItems = buildPendingSummary(state.pendingItems).items.filter((item) => item.status !== '已结清');
  $('#pendingItemSelect').innerHTML = [
    '<option value="">不关联待结清</option>',
    ...openPendingItems.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)} · 剩 ${formatMoney(item.remainingAmount)}</option>`),
  ].join('');
  $('#pendingItemSelect').value = recordDraft.pendingItemId || '';
  renderCharacterSelect();
}

function renderCharacterSelect() {
  const value = recordDraft.characterName;
  $('#recordCharacterSelect').innerHTML = `
    <option value="">启用角色群评</option>
    ${enabledCharacters().map((character) => `<option value="${escapeHtml(character.name)}">只让 ${escapeHtml(character.name)} 评价</option>`).join('')}
  `;
  $('#recordCharacterSelect').value = value;
}

function renderSettings() {
  $('#profileUserName').textContent = state.userProfile.displayName || '我';
  $('#userDisplayName').value = state.userProfile.displayName;
  $('#userAddress').value = state.userProfile.address;
  $('#userSpendingStyle').value = state.userProfile.spendingStyle;
  $('#userCommentMode').value = state.userProfile.commentMode;
  $('#userPersona').value = state.userProfile.persona || '';
  $('#userPromptNote').value = state.userProfile.promptNote || '';
  $('#apiBaseUrl').value = state.settings.apiBaseUrl;
  $('#apiKey').value = state.settings.apiKey;
  $('#evaluationPrompt').value = state.settings.evaluationPrompt || defaultEvaluationPrompt;
  renderApiModelOptions();
  $('#insightPresetText').value = state.insightPreset || '';
  $('#insightOutput').textContent = state.lastInsight?.content || '还没有生成数据短评。';
  $$('.mine-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.minePanelView === activeMinePanel);
  });
  $$('#mineMenu button').forEach((button) => {
    button.classList.toggle('active', button.dataset.minePanel === activeMinePanel);
  });
  renderContacts();
  renderWorldBooks();
  renderCategoryEditor();
  renderBudgetEditor();
  renderAccountEditor();
  renderPendingEditor();
  renderDataPanel();
  void renderPaymentCaptureStatus();
}

function renderApiModelOptions() {
  const models = Array.isArray(state.settings.apiModels) ? state.settings.apiModels : [];
  const selected = state.settings.apiModel || '';
  const options = [...new Set([selected, ...models].filter(Boolean))];
  $('#apiModel').innerHTML = options.length
    ? [
      '<option value="">选择模型</option>',
      ...options.map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`),
    ].join('')
    : '<option value="">先拉取模型</option>';
  $('#apiModel').value = selected;
}

function renderContacts() {
  const selected = state.characters.find((character) => character.id === activeContactId) || state.characters[0];
  if (!activeContactId && selected) activeContactId = selected.id;
  $('#contactList').innerHTML = state.characters.length
    ? state.characters.map((character) => `
      <article class="contact-card ${character.id === activeContactId ? 'active' : ''}" data-contact-id="${escapeHtml(character.id)}">
        ${renderAvatar(character)}
        <div>
          <h3>${escapeHtml(character.name)}</h3>
          <p>${escapeHtml(character.description || character.personality || character.sourceName || '还没有简介')}</p>
        </div>
        <label class="switch-line" title="启用后，记账时会自动让这个角色评账">
          <input type="checkbox" data-toggle-character="${character.id}" ${character.enabled ? 'checked' : ''} />
          <span>评账</span>
        </label>
      </article>
    `).join('')
    : '<p class="empty">还没有角色。点“导入角色卡 JSON/PNG”添加通讯录成员。</p>';
  renderContactDetail(selected);
}

function renderContactDetail(character) {
  if (!character) {
    $('#contactDetail').innerHTML = '';
    return;
  }
  $('#contactDetail').innerHTML = `
    <div class="contact-detail-head">
      ${renderAvatar(character, 'contact-avatar large')}
      <div>
        <h3>${escapeHtml(character.name)}</h3>
        <p>${character.enabled ? '已启用评账' : '未启用评账'}${character.sourceType ? ` · ${character.sourceType.toUpperCase()} 角色卡` : ''}</p>
      </div>
    </div>
    <div class="character-editor">
      <label class="field-label">角色名<input class="text-field" data-character-field="name" value="${escapeHtml(character.name)}" /></label>
      <label class="field-label">简介<textarea class="text-field" rows="3" data-character-field="description">${escapeHtml(character.description || '')}</textarea></label>
      <label class="field-label">性格 / 人设<textarea class="text-field" rows="4" data-character-field="personality">${escapeHtml(character.personality || '')}</textarea></label>
      <label class="field-label">开场白<textarea class="text-field" rows="3" data-character-field="greeting">${escapeHtml(character.greeting || '')}</textarea></label>
      <label class="field-label">角色称呼用户<input class="text-field" data-character-field="addressUser" value="${escapeHtml(character.addressUser || '')}" placeholder="留空则使用“我的信息”里的称呼" /></label>
    </div>
    ${renderCharacterWorldBooks(character)}
    <div class="contact-actions">
      <button type="button" data-contact-select="${escapeHtml(character.id)}">${character.enabled ? '已在评账名单' : '设为评账角色'}</button>
      <button type="button" data-save-character="${escapeHtml(character.id)}">保存修改</button>
      <button type="button" data-delete-character="${escapeHtml(character.id)}">删除联系人</button>
    </div>
  `;
}

function renderCharacterWorldBooks(character) {
  const books = Array.isArray(character.worldBooks) ? character.worldBooks : [];
  if (!books.length) {
    return '<section class="embedded-worldbooks"><h4>角色自带世界书</h4><p class="empty slim">这张角色卡没有自带世界书。</p></section>';
  }
  return `
    <section class="embedded-worldbooks">
      <h4>角色自带世界书</h4>
      ${books.map((book) => `
        <article class="worldbook-entry-editor" data-character-worldbook="${escapeHtml(book.id)}">
          <label class="switch-line inline">
            <input type="checkbox" data-worldbook-field="enabled" ${book.enabled === false ? '' : 'checked'} />
            <span>${escapeHtml(book.name || '角色书')}</span>
          </label>
          ${(book.entries || []).map((entry) => `
            <div class="worldbook-entry-row" data-worldbook-entry="${escapeHtml(entry.id)}">
              <label class="field-label">条目名<input class="text-field" data-entry-field="title" value="${escapeHtml(entry.title || '')}" /></label>
              <label class="field-label">关键词<input class="text-field" data-entry-field="keys" value="${escapeHtml((entry.keys || []).join('，'))}" /></label>
              <label class="field-label">内容<textarea class="text-field" rows="4" data-entry-field="content">${escapeHtml(entry.content || '')}</textarea></label>
              <div class="entry-row-actions">
                <label class="switch-line inline">
                  <input type="checkbox" data-entry-field="enabled" ${entry.enabled === false ? '' : 'checked'} />
                  <span>启用这个条目</span>
                </label>
                <button type="button" data-delete-character-worldbook-entry="${escapeHtml(entry.id)}">删除条目</button>
              </div>
            </div>
          `).join('')}
        </article>
      `).join('')}
    </section>
  `;
}

function renderWorldBooks() {
  $('#worldBookList').innerHTML = state.worldBooks.length
    ? state.worldBooks.map((book) => `
      <article class="worldbook-card" data-worldbook-card="${escapeHtml(book.id)}">
        <div class="worldbook-card-head">
          <div>
            <h3>${escapeHtml(book.name)}</h3>
            <p>${book.entries?.length || 0} 个条目 · ${book.enabled === false ? '未启用' : '已启用'}</p>
          </div>
          <label class="switch-line">
            <input type="checkbox" data-toggle-worldbook="${escapeHtml(book.id)}" ${book.enabled === false ? '' : 'checked'} />
            <span>启用</span>
          </label>
        </div>
        <label class="field-label">世界书名<input class="text-field" data-worldbook-field="name" value="${escapeHtml(book.name)}" /></label>
        ${(book.entries || []).map((entry) => `
          <div class="worldbook-entry-row" data-worldbook-entry="${escapeHtml(entry.id)}">
            <label class="field-label">条目名<input class="text-field" data-entry-field="title" value="${escapeHtml(entry.title || '')}" /></label>
            <label class="field-label">关键词<input class="text-field" data-entry-field="keys" value="${escapeHtml((entry.keys || []).join('，'))}" /></label>
            <label class="field-label">内容<textarea class="text-field" rows="4" data-entry-field="content">${escapeHtml(entry.content || '')}</textarea></label>
            <div class="entry-row-actions">
              <label class="switch-line inline">
                <input type="checkbox" data-entry-field="enabled" ${entry.enabled === false ? '' : 'checked'} />
                <span>启用这个条目</span>
              </label>
              <button type="button" data-delete-worldbook-entry="${escapeHtml(entry.id)}">删除条目</button>
            </div>
          </div>
        `).join('')}
        <div class="worldbook-actions">
          <button type="button" data-add-worldbook-entry="${escapeHtml(book.id)}">新增条目</button>
          <button type="button" data-save-worldbook="${escapeHtml(book.id)}">保存世界书</button>
          <button type="button" data-delete-worldbook="${escapeHtml(book.id)}">删除</button>
        </div>
      </article>
    `).join('')
    : '<p class="empty">还没有世界书。可以导入 SillyTavern 世界书 JSON，也可以点“新建世界书”自己写全局规则。</p>';
}

function renderCategoryEditor() {
  const catalog = buildCategoryCatalog([]);
  const activeIds = new Set(activeCategories().map((category) => category.id));
  const customCategories = state.categoryOverrides.filter((category) => category.custom && category.enabled !== false);
  const rows = [...catalog, ...customCategories].map((category) => {
    const enabled = activeIds.has(category.id);
    return `
      <article class="category-editor-row">
        <div class="entry-icon" style="background:${category.color}">${renderCategoryIcon(category.icon)}</div>
        <div>
          <h3>${escapeHtml(category.name)}</h3>
          <p>${kinds[category.kind] || category.kind}${category.custom ? ' · 自定义' : ' · 默认'}</p>
        </div>
        <button type="button" data-category-action="${category.custom ? 'delete' : (enabled ? 'disable' : 'enable')}" data-category-id="${escapeHtml(category.id)}">
          ${category.custom ? '删除' : (enabled ? '隐藏' : '恢复')}
        </button>
      </article>
    `;
  });
  $('#categoryEditorList').innerHTML = rows.length
    ? rows.join('')
    : '<p class="empty">还没有可管理的分类。</p>';
}

function renderBudgetEditor() {
  $('#budgetMonthlyLimit').value = state.budgets?.monthlyLimit || '';
  const expenseCategories = activeCategories().filter((category) => category.kind === 'expense');
  $('#budgetCategoryInput').innerHTML = expenseCategories
    .map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`)
    .join('');
  const budget = buildBudgetSummary(state.entries, state.budgets, Date.now());
  $('#budgetList').innerHTML = budget.categoryRows.length
    ? budget.categoryRows.map((row) => `
      <article class="category-editor-row">
        <div>
          <h3>${escapeHtml(row.category)}</h3>
          <p>预算 ${formatMoney(row.limit)} · 已花 ${formatMoney(row.spent)} · 剩 ${formatMoney(row.remaining)}</p>
        </div>
        <button type="button" data-delete-category-budget="${escapeHtml(row.category)}">删除</button>
      </article>
    `).join('')
    : '<p class="empty">还没有分类预算。可以先设置本月总预算。</p>';
}

function saveBudget() {
  state.budgets = {
    ...(state.budgets || {}),
    monthlyLimit: Number($('#budgetMonthlyLimit').value || 0),
    categoryLimits: Array.isArray(state.budgets?.categoryLimits) ? state.budgets.categoryLimits : [],
  };
  $('#budgetStatus').textContent = '预算已保存。';
  saveState();
  render();
}

function addCategoryBudget() {
  const category = $('#budgetCategoryInput').value;
  const limit = Number($('#budgetCategoryLimitInput').value || 0);
  if (!category || !limit) {
    $('#budgetStatus').textContent = '先选择分类并填写预算金额。';
    return;
  }
  const rows = (state.budgets?.categoryLimits || []).filter((item) => item.category !== category);
  state.budgets = { ...(state.budgets || {}), categoryLimits: [...rows, { category, limit }] };
  $('#budgetCategoryLimitInput').value = '';
  $('#budgetStatus').textContent = `已添加 ${category} 预算。`;
  saveState();
  render();
}

function deleteCategoryBudget(category) {
  state.budgets = {
    ...(state.budgets || {}),
    categoryLimits: (state.budgets?.categoryLimits || []).filter((item) => item.category !== category),
  };
  saveState();
  render();
}

function renderAccountEditor() {
  if (!state.accounts.length) state.accounts = createDefaultAccounts();
  const flow = summarizeAccountFlow(state.entries);
  const totalBalance = state.accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const accountRows = state.accounts.map((account, index) => {
    const color = account.color || ['#DCEECD', '#D9E8F6', '#F4EDBD', '#E9C4D5'][index % 4];
    return `
    <article class="category-editor-row account-card" style="--row-color:${escapeHtml(color)}">
      <div class="account-dot" aria-hidden="true"></div>
      <div>
        <h3>${escapeHtml(account.name)}</h3>
        <p>余额 ${formatMoney(account.balance || 0)}</p>
      </div>
      <button type="button" data-delete-account="${escapeHtml(account.id)}">删除</button>
    </article>
  `;
  }).join('');
  $('#accountList').innerHTML = `
    <section class="account-flow-summary">
      <span>账户合计 <b>${formatMoney(totalBalance)}</b></span>
      <span>支出 <b>${formatMoney(flow.expense)}</b></span>
      <span>收入 <b>${formatMoney(flow.income)}</b></span>
      <span>转账 <b>${formatMoney(flow.transfer)}</b></span>
    </section>
    ${accountRows}
  `;
}

function addAccount() {
  const name = $('#accountNameInput').value.trim();
  const balance = Number($('#accountBalanceInput').value || 0);
  if (!name) {
    $('#accountStatus').textContent = '先写账户名。';
    return;
  }
  state.accounts = [
    ...state.accounts,
    {
      id: `account-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      balance,
      color: ['#DCEECD', '#D9E8F6', '#F4EDBD', '#E9C4D5'][state.accounts.length % 4],
    },
  ];
  $('#accountNameInput').value = '';
  $('#accountBalanceInput').value = '';
  $('#accountStatus').textContent = `已添加 ${name}`;
  saveState();
  render();
}

function renderDataPanel() {
  const achievements = buildAchievements(state.entries, {
    budgets: state.budgets,
    pendingItems: state.pendingItems,
    now: Date.now(),
  });
  $('#achievementBoard').innerHTML = achievements.map((achievement) => `
    <article class="achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'} tone-${escapeHtml(achievement.tone)}">
      <span>${achievement.unlocked ? '已点亮' : '未点亮'}</span>
      <h3>${escapeHtml(achievement.title)}</h3>
      <p>${escapeHtml(achievement.detail)}</p>
    </article>
  `).join('');

  const comments = buildCharacterAchievementComments(enabledCharacters(), achievements);
  $('#characterDataComments').innerHTML = comments.length
    ? comments.map((message) => `
      <div class="role-bubble data-comment">
        ${renderAvatar({ characterName: message.characterName }, 'bubble-avatar')}
        <div>
          <b>${escapeHtml(message.characterName)}</b>
          <p>${escapeHtml(message.content)}</p>
        </div>
      </div>
    `).join('')
    : '<p class="empty slim">导入并启用角色后，每个人都会在这里评价你的账本成就。</p>';
}

function deleteAccount(accountId) {
  if (state.accounts.length <= 1) {
    $('#accountStatus').textContent = '至少保留一个账户。';
    return;
  }
  state.accounts = state.accounts.filter((account) => account.id !== accountId);
  saveState();
  render();
}

function renderPendingEditor() {
  const summary = buildPendingSummary(state.pendingItems);
  $('#pendingItemList').innerHTML = summary.items.length
    ? summary.items.map((item) => `
      <article class="category-editor-row">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.type)} · 剩 ${formatMoney(item.remainingAmount)} · 次数 ${item.remainingCount} · ${item.status}</p>
          ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
        </div>
        <button type="button" data-delete-pending="${escapeHtml(item.id)}">删除</button>
      </article>
    `).join('')
    : '<p class="empty">还没有待结清事项。</p>';
}

function addPendingItem() {
  const title = $('#pendingTitleInput').value.trim();
  if (!title) {
    $('#pendingStatus').textContent = '先写事项标题。';
    return;
  }
  state.pendingItems = [
    createPendingItem({
      title,
      type: $('#pendingTypeInput').value,
      totalAmount: $('#pendingTotalAmountInput').value,
      usedAmount: $('#pendingUsedAmountInput').value,
      reimbursedAmount: $('#pendingReimbursedAmountInput').value,
      totalCount: $('#pendingTotalCountInput').value,
      usedCount: $('#pendingUsedCountInput').value,
      note: $('#pendingNoteInput').value,
    }),
    ...state.pendingItems,
  ];
  ['pendingTitleInput', 'pendingTotalAmountInput', 'pendingUsedAmountInput', 'pendingReimbursedAmountInput', 'pendingTotalCountInput', 'pendingUsedCountInput', 'pendingNoteInput']
    .forEach((id) => { $(`#${id}`).value = ''; });
  $('#pendingStatus').textContent = '已添加待结清事项。';
  saveState();
  render();
}

function deletePendingItem(itemId) {
  state.pendingItems = state.pendingItems.filter((item) => item.id !== itemId);
  saveState();
  render();
}

function getPaymentNotificationsPlugin() {
  return globalThis.Capacitor?.Plugins?.PaymentNotifications || null;
}

function splitLines(value) {
  return String(value || '')
    .split(/\r?\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function currentWhitelist() {
  return splitLines($('#paymentAppWhitelist')?.value || '').length
    ? splitLines($('#paymentAppWhitelist').value)
    : defaultPaymentAppWhitelist;
}

function setWhitelist(packages) {
  $('#paymentAppWhitelist').value = [...new Set(packages.map((item) => String(item || '').trim()).filter(Boolean))].join('\n');
}

function fillPaymentCaptureSettings(settings = {}) {
  const whitelist = Array.isArray(settings.appWhitelist) && settings.appWhitelist.length
    ? settings.appWhitelist
    : defaultPaymentAppWhitelist;
  const keywords = Array.isArray(settings.paymentKeywords) && settings.paymentKeywords.length
    ? settings.paymentKeywords
    : defaultPaymentKeywords;
  $('#paymentAppWhitelist').value = whitelist.join('\n');
  $('#paymentKeywordList').value = keywords.join('\n');
  $('#paymentAutoRecordEnabled').checked = settings.autoRecordEnabled !== false;
  renderInstalledAppPicker();
}

function renderInstalledAppPicker() {
  const list = $('#installedAppList');
  if (!list) return;
  if (!installedApps.length) {
    list.innerHTML = '<p class="empty slim">点“读取已安装 App”，再搜索并加入白名单。</p>';
    return;
  }
  const query = installedAppQuery.trim().toLowerCase();
  const whitelist = new Set(currentWhitelist());
  const visibleApps = installedApps
    .filter((app) => {
      if (!query) return true;
      return String(app.label || '').toLowerCase().includes(query)
        || String(app.packageName || '').toLowerCase().includes(query);
    })
    .slice(0, 80);
  list.innerHTML = visibleApps.length
    ? visibleApps.map((app) => {
      const added = whitelist.has(app.packageName);
      return `
        <article class="installed-app-row">
          <div>
            <h3>${escapeHtml(app.label || app.packageName)}</h3>
            <p>${escapeHtml(app.packageName)}${app.system ? ' · 系统' : ''}</p>
          </div>
          <button type="button" data-add-installed-app="${escapeHtml(app.packageName)}">${added ? '已加入' : '加入'}</button>
        </article>
      `;
    }).join('')
    : '<p class="empty slim">没有匹配的 App。</p>';
}

async function loadInstalledApps() {
  const plugin = getPaymentNotificationsPlugin();
  if (!plugin) {
    $('#paymentCaptureStatus').textContent = '浏览器预览不能读取手机已安装 App；请在 APK 里使用这个选择器。';
    return;
  }
  $('#paymentCaptureStatus').textContent = '正在读取已安装 App...';
  try {
    const result = await plugin.listInstalledApps();
    installedApps = Array.isArray(result.apps) ? result.apps : [];
    renderInstalledAppPicker();
    $('#paymentCaptureStatus').textContent = `已读取 ${installedApps.length} 个 App，搜索后可加入白名单。`;
  } catch (error) {
    $('#paymentCaptureStatus').textContent = `读取已安装 App 失败：${error instanceof Error ? error.message : '未知错误'}`;
  }
}

function addInstalledAppToWhitelist(packageName) {
  const next = [...currentWhitelist(), packageName];
  setWhitelist(next);
  renderInstalledAppPicker();
}

async function renderPaymentCaptureStatus() {
  const status = $('#paymentCaptureStatus');
  if (!status) return;
  const plugin = getPaymentNotificationsPlugin();
  if (!plugin) {
    if (!paymentSettingsLoaded) {
      fillPaymentCaptureSettings({
        appWhitelist: defaultPaymentAppWhitelist,
        paymentKeywords: defaultPaymentKeywords,
        autoRecordEnabled: true,
      });
      paymentSettingsLoaded = true;
    }
    status.textContent = '浏览器预览不能读取支付页面；APK 里开启通知或无障碍权限后才会自动捕获。';
    return;
  }
  try {
    const [permissionResult, settings] = await Promise.all([
      plugin.isEnabled(),
      plugin.getCaptureSettings(),
    ]);
    if (!paymentSettingsLoaded) {
      fillPaymentCaptureSettings(settings);
      paymentSettingsLoaded = true;
    }
    const notificationText = permissionResult.enabled ? '通知已开' : '通知未开';
    const accessibilityText = permissionResult.accessibilityEnabled ? '无障碍已开' : '无障碍未开';
    const autoText = settings.autoRecordEnabled === false ? '自动捕获已关' : '自动捕获已开';
    status.textContent = `${notificationText} · ${accessibilityText} · ${autoText}`;
  } catch (error) {
    status.textContent = '通知权限状态读取失败，请在 Android 系统设置里检查。';
  }
}

async function openPaymentNotificationSettings() {
  const plugin = getPaymentNotificationsPlugin();
  if (!plugin) {
    $('#paymentCaptureStatus').textContent = '当前是浏览器预览，无法打开 Android 通知监听设置。';
    return;
  }
  await plugin.openSettings();
  $('#paymentCaptureStatus').textContent = '已打开系统通知监听设置，授权后回到今日小账同步。';
}

async function openPaymentAccessibilitySettings() {
  const plugin = getPaymentNotificationsPlugin();
  if (!plugin) {
    $('#paymentCaptureStatus').textContent = '当前是浏览器预览，无法打开 Android 无障碍设置。';
    return;
  }
  await plugin.openAccessibilitySettings();
  $('#paymentCaptureStatus').textContent = '已打开系统无障碍设置。找到今日小账并开启后，支付成功页会进入本机待同步队列。';
}

async function savePaymentCaptureSettings() {
  const plugin = getPaymentNotificationsPlugin();
  const nextSettings = {
    appWhitelist: splitLines($('#paymentAppWhitelist').value),
    paymentKeywords: splitLines($('#paymentKeywordList').value),
    autoRecordEnabled: $('#paymentAutoRecordEnabled').checked,
  };
  if (!nextSettings.appWhitelist.length) nextSettings.appWhitelist = defaultPaymentAppWhitelist;
  if (!nextSettings.paymentKeywords.length) nextSettings.paymentKeywords = defaultPaymentKeywords;
  fillPaymentCaptureSettings(nextSettings);
  if (!plugin) {
    $('#paymentCaptureStatus').textContent = '浏览器预览已更新显示规则；APK 里会保存到本机原生设置。';
    return;
  }
  try {
    const saved = await plugin.saveCaptureSettings(nextSettings);
    fillPaymentCaptureSettings(saved);
    $('#paymentCaptureStatus').textContent = '自动记账规则已保存到本机。';
  } catch (error) {
    $('#paymentCaptureStatus').textContent = `规则保存失败：${error instanceof Error ? error.message : '未知错误'}`;
  }
}

async function autoSyncDetectedPayments() {
  const plugin = getPaymentNotificationsPlugin();
  if (!plugin || paymentSyncInFlight) return;
  try {
    const settings = await plugin.getCaptureSettings();
    if (settings.autoRecordEnabled === false) return;
    await syncDetectedPayments({ silent: true });
  } catch {
    // Native capture is optional; explicit sync button will surface errors.
  }
}

function paymentAccountId(record = {}) {
  const accounts = state.accounts.length ? state.accounts : createDefaultAccounts();
  const packageName = String(record.packageName || '');
  const preferred = packageName.includes('tencent.mm')
    ? accounts.find((account) => account.id === 'wechat' || account.name.includes('微信'))
    : accounts.find((account) => account.name.includes('支付宝')) || accounts.find((account) => account.id === 'other');
  return preferred?.id || accounts[0]?.id || '';
}

function buildPaymentEntry(record = {}) {
  const text = [record.title, record.text].filter(Boolean).join(' · ');
  const inferred = inferCategoryByKeywords(text, activeCategories(), 'expense');
  const category = inferred.category || activeCategories().find((item) => item.kind === 'expense')?.name || '其他支出';
  return {
    id: `payment-${record.id || makeId()}`,
    kind: 'expense',
    category,
    title: text.slice(0, 40) || category,
    amount: Number(record.amount || 0),
    note: text,
    createdAt: Number(record.postedAt || Date.now()),
    accountId: paymentAccountId(record),
    fromAccountId: '',
    toAccountId: '',
    feeAmount: 0,
    pendingItemId: '',
    autoCategorySource: inferred.source ? `payment-notification:${inferred.source}` : 'payment-notification',
    sourcePaymentId: String(record.id || ''),
  };
}

async function syncDetectedPayments(options = {}) {
  const plugin = getPaymentNotificationsPlugin();
  if (!plugin) {
    $('#paymentCaptureStatus').textContent = '当前是浏览器预览，无法读取系统支付通知。APK 里授权后才能同步。';
    return;
  }
  if (paymentSyncInFlight) return;
  paymentSyncInFlight = true;
  try {
    const result = await plugin.getDetectedPayments();
    const records = Array.isArray(result.records) ? result.records : [];
    const existing = new Set(state.entries.map((entry) => String(entry.sourcePaymentId || entry.id)));
    const nextEntries = records
      .map(buildPaymentEntry)
      .filter((entry) => entry.amount > 0 && !existing.has(entry.sourcePaymentId));
    if (!nextEntries.length) {
      if (!options.silent) $('#paymentCaptureStatus').textContent = '没有新的支付记录可同步。';
      return;
    }
    const evaluators = enabledCharacters();
    const canEvaluate = Boolean(state.settings.apiBaseUrl.trim() && state.settings.apiModel.trim());
    const stampedEntries = nextEntries.map((entry) => ({
      ...entry,
      evaluations: [],
      evaluationStatus: evaluators.length ? (canEvaluate ? 'pending' : 'api-missing') : 'no-character',
    }));
    state.entries = [...stampedEntries, ...state.entries];
    state.accounts = stampedEntries.reduce(
      (accounts, entry) => applyEntryToAccounts(accounts, entry),
      state.accounts.length ? state.accounts : createDefaultAccounts(),
    );
    await plugin.clearDetectedPayments();
    saveState();
    $('#paymentCaptureStatus').textContent = `已自动同步 ${stampedEntries.length} 笔支付记录。`;
    render();
    if (evaluators.length && canEvaluate) {
      stampedEntries.forEach((entry) => {
        void updateCharacterEvaluations(entry, evaluators);
      });
    }
  } catch (error) {
    if (!options.silent) $('#paymentCaptureStatus').textContent = `同步失败：${error instanceof Error ? error.message : '未知错误'}`;
  } finally {
    paymentSyncInFlight = false;
  }
}

function upsertCategoryOverride(nextOverride) {
  state.categoryOverrides = [
    ...state.categoryOverrides.filter((override) => override.id !== nextOverride.id),
    nextOverride,
  ];
}

function addCategory() {
  const name = $('#categoryNameInput').value.trim();
  const icon = $('#categoryIconInput').value.trim() || name.slice(0, 1) || '+';
  const kind = $('#categoryKindInput').value;
  const color = $('#categoryColorInput').value || '#D9E8F6';
  const keywords = normalizeKeywordList($('#categoryKeywordsInput').value || name);
  if (!name) {
    $('#categoryStatus').textContent = '先写一个分类名。';
    return;
  }
  upsertCategoryOverride({
    id: `cat-custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    kind,
    icon,
    color,
    keywords,
    enabled: true,
    custom: true,
  });
  $('#categoryNameInput').value = '';
  $('#categoryIconInput').value = '';
  $('#categoryKeywordsInput').value = '';
  $('#categoryStatus').textContent = `已添加 ${name}`;
  saveState();
  render();
}

function updateCategoryVisibility(categoryId, action) {
  const catalogCategory = buildCategoryCatalog([]).find((category) => category.id === categoryId);
  const customCategory = state.categoryOverrides.find((category) => category.id === categoryId && category.custom);
  if (action === 'delete') {
    state.categoryOverrides = state.categoryOverrides.filter((category) => category.id !== categoryId);
  } else if (catalogCategory) {
    upsertCategoryOverride({ ...catalogCategory, enabled: action === 'enable', custom: false });
  } else if (customCategory) {
    upsertCategoryOverride({ ...customCategory, enabled: action === 'enable' });
  }
  saveState();
  render();
}

let audioContext;

function playKeypadTap() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ||= new AudioContextClass();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(620, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(420, audioContext.currentTime + 0.045);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.055);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.06);
  } catch {
    // Sound feedback is optional; visual feedback still works if audio is blocked.
  }
}

function flashKeypadButton(button) {
  button.classList.remove('key-pressed');
  void button.offsetWidth;
  button.classList.add('key-pressed');
  window.setTimeout(() => button.classList.remove('key-pressed'), 160);
  if (navigator.vibrate) navigator.vibrate(8);
}

function flashTapTarget(target) {
  target.classList.remove('tap-pressed');
  void target.offsetWidth;
  target.classList.add('tap-pressed');
  window.setTimeout(() => target.classList.remove('tap-pressed'), 180);
  if (navigator.vibrate) navigator.vibrate(6);
}

function handleKeypad(key) {
  if (key === 'clear') {
    recordDraft.amountBuffer = '';
  } else if (key === 'back') {
    recordDraft.amountBuffer = recordDraft.amountBuffer.slice(0, -1);
  } else if (key === '.') {
    if (recordDraft.amountBuffer.includes('.')) return;
    recordDraft.amountBuffer = recordDraft.amountBuffer ? `${recordDraft.amountBuffer}.` : '0.';
  } else if (/^\d$/.test(key)) {
    if (recordDraft.amountBuffer.includes('.') && recordDraft.amountBuffer.split('.')[1].length >= 2) return;
    if (recordDraft.amountBuffer === '0') recordDraft.amountBuffer = key;
    else recordDraft.amountBuffer += key;
  }
  renderRecord();
}

function saveEntry() {
  const amount = Number(recordDraft.amountBuffer);
  if (!amount || amount <= 0) {
    $('#recordStatus').textContent = '先输入金额。';
    return;
  }
  const entry = {
    id: makeId(),
    kind: recordDraft.kind,
    category: recordDraft.category,
    title: recordDraft.note.trim() || recordDraft.category,
    amount,
    note: recordDraft.note.trim(),
    createdAt: Date.now(),
    accountId: recordDraft.kind === 'transfer' ? '' : recordDraft.accountId,
    fromAccountId: recordDraft.kind === 'transfer' ? recordDraft.fromAccountId : '',
    toAccountId: recordDraft.kind === 'transfer' ? recordDraft.toAccountId : '',
    feeAmount: recordDraft.kind === 'transfer' ? Number(recordDraft.feeAmount || 0) : 0,
    pendingItemId: recordDraft.pendingItemId || '',
    autoCategorySource: recordDraft.autoCategorySource || '',
  };
  const duplicateCandidates = findDuplicateCandidates(entry, state.entries);
  if (duplicateCandidates.length && !confirm('这笔账和今天已有记录很像，可能重复。确定还要保存吗？')) {
    $('#recordStatus').textContent = '已取消保存，避免重复记账。';
    return;
  }
  const feeEntry = entry.kind === 'transfer' ? buildFeeEntryForTransfer(entry) : null;
  const evaluators = recordDraft.characterName
    ? state.characters.filter((character) => character.name === recordDraft.characterName)
    : enabledCharacters();
  const canEvaluate = Boolean(state.settings.apiBaseUrl.trim() && state.settings.apiModel.trim());
  entry.evaluations = [];
  entry.evaluationStatus = evaluators.length
    ? (canEvaluate ? 'pending' : 'api-missing')
    : 'no-character';
  state.entries = [entry, ...(feeEntry ? [feeEntry] : []), ...state.entries];
  state.accounts = applyEntryToAccounts(state.accounts.length ? state.accounts : createDefaultAccounts(), entry);
  saveState();
  recordDraft = createDraft('expense', activeCategories());
  $('#recordStatus').textContent = '';
  activePage = 'evaluate';
  selectedDate = entry.createdAt;
  calendarCursor = selectedDate;
  detailScope = 'day';
  render();
  if (evaluators.length && canEvaluate) {
    void updateCharacterEvaluations(entry, evaluators);
  }
}

async function updateCharacterEvaluations(entry, evaluators) {
  try {
    const replies = await Promise.all(evaluators.slice(0, 4).map((character, index) => (
      requestCharacterEvaluation(entry, character).then((content) => ({
        id: `eval-${entry.id}-${character.id || character.name}-${index}`,
        type: 'character',
        characterId: character.id || character.name,
        characterName: character.name,
        avatar: character.avatar || character.name?.slice(0, 1) || '角',
        content,
        createdAt: Date.now() + index,
      }))
    )));
    state.entries = state.entries.map((item) => (
      item.id === entry.id ? { ...item, evaluations: replies, evaluationStatus: '' } : item
    ));
  } catch (error) {
    state.entries = state.entries.map((item) => (
      item.id === entry.id ? { ...item, evaluationStatus: 'failed' } : item
    ));
  }
  saveState();
  render();
}

async function requestCharacterEvaluation(entry, character) {
  const { apiBaseUrl, apiKey, apiModel } = state.settings;
  const endpoint = buildChatEndpoint(apiBaseUrl);
  const sameCategoryCount = state.entries.filter((item) => (
    item.category === entry.category && isSameDay(item.createdAt, entry.createdAt)
  )).length;
  const worldInfoContext = [
    entry.title,
    entry.category,
    entry.note,
    character.name,
    character.description,
    character.personality,
    state.userProfile.persona,
    state.userProfile.promptNote,
  ].filter(Boolean).join('\n');
  const characterWorldBooks = (character.worldBooks || []).map((book) => ({
    ...book,
    name: `${character.name} / ${book.name}`,
  }));
  const worldInfo = selectWorldBookEntries([...state.worldBooks, ...characterWorldBooks], worldInfoContext);
  const budget = buildBudgetSummary(state.entries, state.budgets, entry.createdAt);
  const categoryBudget = getCategoryBudgetStatus(state.entries, state.budgets, entry.category, entry.createdAt);
  const prompt = [
    '事实边界：角色设定、用户人设和世界书只用于语气与称呼，不得用来补全账单事实。',
    '短评只能引用本次账单里明确出现的信息；没有写出的地点、目的、人物、路线、时间安排都不能说。',
    '输出一整句短评即可，不要编号，不要分析报告。',
    character.description ? `角色简介：${character.description}` : '',
    character.personality ? `角色性格：${character.personality}` : '',
    state.userProfile.displayName ? `用户昵称：${state.userProfile.displayName}` : '',
    state.userProfile.address ? `角色称呼用户：${character.addressUser || state.userProfile.address}` : '',
    state.userProfile.persona ? `用户人设：${state.userProfile.persona}` : '',
    state.userProfile.promptNote ? `用户评账偏好：${state.userProfile.promptNote}` : '',
    budget.remaining === null ? '' : `预算事实：本月已支出 ${formatMoney(budget.monthlyExpense)}，本月预算剩余 ${formatMoney(budget.remaining)}，${budget.overLimit ? '已经超出总预算' : '尚未超出总预算'}。`,
    categoryBudget.remaining === null ? '' : `分类预算事实：${entry.category} 已支出 ${formatMoney(categoryBudget.spent)}，剩余 ${formatMoney(categoryBudget.remaining)}。`,
    worldInfo.length ? `世界书命中条目：\n${worldInfo.map((entry) => `【${entry.bookName} / ${entry.title}】${entry.content}`).join('\n')}` : '',
    buildCharacterPrompt({
      characterName: character.name,
      entry,
      sameCategoryCount,
      evaluationPrompt: state.settings.evaluationPrompt || defaultEvaluationPrompt,
    }),
  ].filter(Boolean).join('\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
    },
    body: JSON.stringify({
      model: apiModel.trim(),
      temperature: 0.75,
      max_tokens: 800,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: '请对这笔账短短回应。' },
      ],
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return (data?.choices?.[0]?.message?.content || '').trim() || '我看完了，这笔已经记进账本。';
}

function buildChatEndpoint(apiBaseUrl) {
  const base = apiBaseUrl.replace(/\/+$/, '');
  return base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

function buildModelsEndpoint(apiBaseUrl) {
  const base = apiBaseUrl.replace(/\/+$/, '');
  return base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`;
}

function isSameDay(a, b) {
  const left = new Date(a);
  const right = new Date(b);
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function deleteEntry(entryId) {
  state.entries = state.entries.filter((entry) => entry.id !== entryId);
  saveState();
  render();
}

function saveSettings() {
  const selectedModel = $('#apiModel').value.trim();
  state.settings = {
    ...state.settings,
    apiBaseUrl: $('#apiBaseUrl').value.trim(),
    apiKey: $('#apiKey').value.trim(),
    apiModel: selectedModel,
    apiModels: Array.isArray(state.settings.apiModels) ? state.settings.apiModels : [],
  };
  saveState();
  render();
}

async function fetchModels() {
  state.settings = {
    ...state.settings,
    apiBaseUrl: $('#apiBaseUrl').value.trim(),
    apiKey: $('#apiKey').value.trim(),
  };
  const { apiBaseUrl, apiKey, apiModel } = state.settings;
  if (!apiBaseUrl) {
    $('#apiStatus').textContent = '先填接口地址。DeepSeek 可以填 https://api.deepseek.com';
    return;
  }
  $('#apiStatus').textContent = '正在拉取模型...';
  try {
    const response = await fetch(buildModelsEndpoint(apiBaseUrl), {
      method: 'GET',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const models = (Array.isArray(data?.data) ? data.data : [])
      .map((model) => String(model.id || model.name || '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
    if (!models.length) throw new Error('没有读取到模型列表');
    state.settings = {
      ...state.settings,
      apiModels: models,
      apiModel: models.includes(apiModel) ? apiModel : models[0],
    };
    saveState();
    renderSettings();
    $('#apiStatus').textContent = `已拉取 ${models.length} 个模型，当前选择 ${state.settings.apiModel}`;
  } catch (error) {
    $('#apiStatus').textContent = `模型拉取失败：${error instanceof Error ? error.message : '未知错误'}`;
  }
}

async function testApiSettings() {
  saveSettings();
  const { apiBaseUrl, apiKey, apiModel } = state.settings;
  if (!apiBaseUrl || !apiModel) {
    $('#apiStatus').textContent = '先填接口地址和模型。';
    return;
  }
  $('#apiStatus').textContent = '正在测试 API...';
  try {
    const response = await fetch(buildChatEndpoint(apiBaseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: apiModel,
        temperature: 0.2,
        max_tokens: 320,
        messages: [
          { role: 'system', content: '你是记账软件的 API 连通性测试。' },
          { role: 'user', content: '请只回复 OK。' },
        ],
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    $('#apiStatus').textContent = 'API 可以连通。';
  } catch (error) {
    $('#apiStatus').textContent = `API 测试失败：${error instanceof Error ? error.message : '未知错误'}`;
  }
}

function entriesForInsight(scope) {
  if (scope === 'month') return buildScopedSummary(state.entries, 'month', calendarCursor).entries;
  const now = Date.now();
  const date = new Date(now);
  const day = date.getDay() || 7;
  const start = new Date(date);
  start.setDate(date.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return state.entries.filter((entry) => entry.createdAt >= start.getTime() && entry.createdAt < end.getTime());
}

async function importInsightPreset(file) {
  if (!file) return;
  const text = await file.text();
  state.insightPreset = text.trim();
  saveState();
  renderSettings();
}

async function generateInsight() {
  state.insightPreset = $('#insightPresetText').value.trim();
  saveState();
  const { apiBaseUrl, apiKey, apiModel } = state.settings;
  if (!apiBaseUrl || !apiModel) {
    $('#insightOutput').textContent = '先在 API 设置里填接口地址和模型。';
    return;
  }
  const scope = $('#insightScope').value;
  const entries = entriesForInsight(scope);
  if (!entries.length) {
    $('#insightOutput').textContent = '这个周期还没有账单，先记几笔再总结。';
    return;
  }
  const expense = entries.filter((entry) => entry.kind === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
  const income = entries.filter((entry) => entry.kind === 'income').reduce((sum, entry) => sum + entry.amount, 0);
  const categoryStats = [...entries.reduce((map, entry) => {
    if (entry.kind !== 'expense') return map;
    const row = map.get(entry.category) || { category: entry.category, count: 0, amount: 0 };
    row.count += 1;
    row.amount += Number(entry.amount || 0);
    map.set(entry.category, row);
    return map;
  }, new Map()).values()]
    .sort((left, right) => right.amount - left.amount)
    .map((row) => `${row.category}：${row.count} 次，${formatMoney(row.amount)}`)
    .join('\n');
  const lines = entries.slice(0, 30).map((entry) => `${kinds[entry.kind] || entry.kind} / ${entry.category} / ${entry.title} / ${formatMoney(entry.amount)}`).join('\n');
  $('#insightOutput').textContent = '正在生成数据短评...';
  try {
    const response = await fetch(buildChatEndpoint(apiBaseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: apiModel,
        temperature: 0.75,
        max_tokens: 900,
        messages: [
          {
            role: 'system',
            content: [
              '你是记账软件里的周期数据短评，不是自由聊天。',
              '根据用户性格、预设和账单数据，写一段轻松但有用的短评。',
              '不要编造没有给出的账单，不要替用户做决定。',
              state.insightPreset ? `用户导入的预设：${state.insightPreset}` : '',
            ].filter(Boolean).join('\n'),
          },
          {
            role: 'user',
            content: [
              `周期：${scope === 'month' ? '本月' : '本周'}`,
              `用户昵称：${state.userProfile.displayName || '我'}`,
              `消费风格：${state.userProfile.spendingStyle || '未设置'}`,
              `评价语气：${state.userProfile.commentMode || '未设置'}`,
              `支出合计：${formatMoney(expense)}`,
              `收入合计：${formatMoney(income)}`,
              categoryStats ? `分类次数与金额：\n${categoryStats}` : '',
              '账单：',
              lines,
            ].join('\n'),
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const content = (data?.choices?.[0]?.message?.content || '').trim() || '这段时间账本已经整理好了，可以回头看看哪些花销最常出现。';
    state.lastInsight = { scope, content, createdAt: Date.now() };
    saveState();
    $('#insightOutput').textContent = content;
  } catch (error) {
    $('#insightOutput').textContent = `生成失败：${error instanceof Error ? error.message : '未知错误'}`;
  }
}

function saveUserProfile() {
  state.userProfile = {
    ...state.userProfile,
    displayName: $('#userDisplayName').value.trim() || '我',
    address: $('#userAddress').value.trim() || '你',
    spendingStyle: $('#userSpendingStyle').value,
    commentMode: $('#userCommentMode').value,
    persona: $('#userPersona').value.trim(),
    promptNote: $('#userPromptNote').value.trim(),
  };
  saveState();
  render();
}

async function importCharacterCard(file) {
  if (!file) return;
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
  const character = isPng
    ? parseCharacterCardFromPngBytes(new Uint8Array(await file.arrayBuffer()))
    : parseCharacterCard(await file.text());
  if (isPng && !character.avatar) {
    character.avatar = await fileToDataUrl(file);
  }
  character.sourceName = file.name;
  character.sourceType = character.sourceType || (isPng ? 'png' : 'json');
  state.characters = [
    ...state.characters.filter((item) => item.name !== character.name),
    character,
  ];
  activeContactId = character.id;
  return character;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', () => reject(reader.error || new Error('读取图片失败')));
    reader.readAsDataURL(file);
  });
}

async function importCharacterCards(files) {
  const list = [...(files || [])];
  if (!list.length) return;
  const imported = [];
  const errors = [];
  for (const file of list) {
    try {
      imported.push(await importCharacterCard(file));
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : '导入失败'}`);
    }
  }
  saveState();
  $('#importStatus').textContent = [
    imported.length ? `已导入 ${imported.map((character) => character.name).join('、')}` : '',
    errors.length ? `失败 ${errors.length} 个：${errors.join('；')}` : '',
  ].filter(Boolean).join('；');
  render();
}

async function importWorldBooks(files) {
  const list = [...(files || [])];
  if (!list.length) return;
  const imported = [];
  const errors = [];
  for (const file of list) {
    try {
      const book = parseWorldBook(await file.text());
      book.sourceName = file.name;
      state.worldBooks = [
        ...state.worldBooks.filter((item) => item.name !== book.name),
        book,
      ];
      imported.push(book);
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : '导入失败'}`);
    }
  }
  saveState();
  $('#worldBookStatus').textContent = [
    imported.length ? `已导入 ${imported.map((book) => book.name).join('、')}` : '',
    errors.length ? `失败 ${errors.length} 个：${errors.join('；')}` : '',
  ].filter(Boolean).join('；');
  render();
}

function makeWorldBookId() {
  return `world-manual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeWorldBookEntryId() {
  return `entry-manual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveEvaluationPrompt() {
  state.settings = {
    ...state.settings,
    evaluationPrompt: $('#evaluationPrompt').value.trim() || defaultEvaluationPrompt,
  };
  saveState();
  $('#worldBookStatus').textContent = '已保存全局评账 Prompt。';
  render();
}

function resetEvaluationPrompt() {
  state.settings = {
    ...state.settings,
    evaluationPrompt: defaultEvaluationPrompt,
  };
  saveState();
  $('#worldBookStatus').textContent = '已恢复默认评账 Prompt。';
  render();
}

function addWorldBook() {
  const index = state.worldBooks.filter((book) => book.source === 'manual').length + 1;
  state.worldBooks = [
    {
      id: makeWorldBookId(),
      name: `全局规则 ${index}`,
      enabled: true,
      source: 'manual',
      importedAt: Date.now(),
      entries: [
        {
          id: makeWorldBookEntryId(),
          title: '新条目',
          keys: [],
          content: '',
          enabled: true,
        },
      ],
    },
    ...state.worldBooks,
  ];
  saveState();
  activeMinePanel = 'worldbooks';
  $('#worldBookStatus').textContent = '已新建世界书，可以直接填写条目。';
  render();
}

function toggleWorldBook(bookId, enabled) {
  state.worldBooks = state.worldBooks.map((book) => (
    book.id === bookId ? { ...book, enabled } : book
  ));
  saveState();
  render();
}

function deleteWorldBook(bookId) {
  state.worldBooks = state.worldBooks.filter((book) => book.id !== bookId);
  saveState();
  render();
}

function confirmEntryDelete() {
  return window.confirm('确定删除这个条目吗？删除后会立刻从本地世界书里移除。');
}

function deleteWorldBookEntry(bookId, entryId) {
  if (!confirmEntryDelete()) return;
  state.worldBooks = state.worldBooks.map((book) => (
    book.id === bookId
      ? { ...book, entries: (book.entries || []).filter((entry) => entry.id !== entryId) }
      : book
  ));
  saveState();
  render();
}

function deleteCharacterWorldBookEntry(characterId, bookId, entryId) {
  if (!confirmEntryDelete()) return;
  state.characters = state.characters.map((character) => {
    if (character.id !== characterId) return character;
    return {
      ...character,
      worldBooks: (character.worldBooks || []).map((book) => (
        book.id === bookId
          ? { ...book, entries: (book.entries || []).filter((entry) => entry.id !== entryId) }
          : book
      )),
    };
  });
  saveState();
  render();
}

function splitKeys(value) {
  return String(value || '')
    .split(/[,，\n]/)
    .map((key) => key.trim())
    .filter(Boolean);
}

function readEntryEditor(row, originalEntry) {
  const title = row.querySelector('[data-entry-field="title"]')?.value.trim() || originalEntry.title || '';
  const keys = splitKeys(row.querySelector('[data-entry-field="keys"]')?.value || '');
  const content = row.querySelector('[data-entry-field="content"]')?.value.trim() || '';
  const enabledInput = row.querySelector('[data-entry-field="enabled"]');
  return {
    ...originalEntry,
    title,
    keys,
    content,
    enabled: enabledInput ? enabledInput.checked : originalEntry.enabled !== false,
  };
}

function readWorldBookCard(card, book) {
  return {
    ...book,
    name: card.querySelector('[data-worldbook-field="name"]')?.value.trim() || book.name,
    enabled: card.querySelector('[data-toggle-worldbook]')?.checked !== false,
    entries: (book.entries || []).map((entry) => {
      const row = [...card.querySelectorAll('[data-worldbook-entry]')]
        .find((node) => node.dataset.worldbookEntry === entry.id);
      return row ? readEntryEditor(row, entry) : entry;
    }).filter((entry) => entry.content || entry.title || entry.keys.length),
  };
}

function saveCharacterDetail(characterId) {
  const character = state.characters.find((item) => item.id === characterId);
  if (!character) return;
  const detail = $('#contactDetail');
  const field = (name) => detail.querySelector(`[data-character-field="${name}"]`)?.value.trim() || '';
  const nextWorldBooks = (character.worldBooks || []).map((book) => {
    const bookNode = [...detail.querySelectorAll('[data-character-worldbook]')]
      .find((node) => node.dataset.characterWorldbook === book.id);
    if (!bookNode) return book;
    return {
      ...book,
      enabled: bookNode.querySelector('[data-worldbook-field="enabled"]')?.checked !== false,
      entries: (book.entries || []).map((entry) => {
        const row = [...bookNode.querySelectorAll('[data-worldbook-entry]')]
          .find((node) => node.dataset.worldbookEntry === entry.id);
        return row ? readEntryEditor(row, entry) : entry;
      }).filter((entry) => entry.content),
    };
  });
  const nextName = field('name') || character.name;
  state.characters = state.characters.map((item) => (
    item.id === characterId
      ? {
        ...item,
        name: nextName,
        description: field('description'),
        personality: field('personality'),
        greeting: field('greeting'),
        addressUser: field('addressUser'),
        worldBooks: nextWorldBooks.map((book) => ({ ...book, ownerCharacterName: nextName })),
      }
      : item
  ));
  saveState();
  render();
}

function saveWorldBook(bookId) {
  const card = [...$('#worldBookList').querySelectorAll('[data-worldbook-card]')]
    .find((node) => node.dataset.worldbookCard === bookId);
  if (!card) return;
  state.worldBooks = state.worldBooks.map((book) => {
    if (book.id !== bookId) return book;
    return readWorldBookCard(card, book);
  });
  saveState();
  render();
}

function addWorldBookEntry(bookId) {
  const card = [...$('#worldBookList').querySelectorAll('[data-worldbook-card]')]
    .find((node) => node.dataset.worldbookCard === bookId);
  state.worldBooks = state.worldBooks.map((book) => {
    if (book.id !== bookId) return book;
    const current = card ? readWorldBookCard(card, book) : book;
    return {
      ...current,
      entries: [
        ...(current.entries || []),
        {
          id: makeWorldBookEntryId(),
          title: '新条目',
          keys: [],
          content: '',
          enabled: true,
        },
      ],
    };
  });
  saveState();
  render();
}

function toggleCharacter(characterId, enabled) {
  state.characters = state.characters.map((character) => (
    character.id === characterId ? { ...character, enabled } : character
  ));
  saveState();
  render();
}

function deleteCharacter(characterId) {
  state.characters = state.characters.filter((character) => character.id !== characterId);
  if (activeContactId === characterId) {
    activeContactId = state.characters[0]?.id || '';
  }
  saveState();
  render();
}

function bindEvents() {
  document.addEventListener('pointerdown', (event) => {
    const target = event.target.closest('button, .import-button');
    if (!target || target.closest('#keypad') || target.disabled) return;
    flashTapTarget(target);
    playKeypadTap();
  }, { passive: true });
  $('.bottom-nav').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (button) setPage(button.dataset.page);
  });
  $('#mineMenu').addEventListener('click', (event) => {
    const button = event.target.closest('[data-mine-panel]');
    if (!button) return;
    activeMinePanel = activeMinePanel === button.dataset.minePanel ? '' : button.dataset.minePanel;
    renderSettings();
  });
  $$('.panel-close').forEach((button) => {
    button.addEventListener('click', () => {
      activeMinePanel = '';
      renderSettings();
    });
  });
  $('#detailScopeTabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-detail-scope]');
    if (!button) return;
    detailScope = button.dataset.detailScope;
    render();
  });
  $('#detailViewTabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-detail-view]');
    if (!button) return;
    detailView = button.dataset.detailView;
    render();
  });
  $('#calendarPrev').addEventListener('click', () => {
    calendarCursor = shiftMonth(calendarCursor, -1);
    selectedDate = calendarCursor;
    render();
  });
  $('#calendarNext').addEventListener('click', () => {
    calendarCursor = shiftMonth(calendarCursor, 1);
    selectedDate = calendarCursor;
    render();
  });
  $('#calendarGrid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-calendar-day]');
    if (!button) return;
    selectedDate = Number(button.dataset.calendarDay);
    calendarCursor = selectedDate;
    detailScope = 'day';
    render();
  });
  $('#recordKindTabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-kind]');
    if (!button) return;
    recordDraft = {
      ...createDraft(button.dataset.kind, activeCategories()),
      amountBuffer: recordDraft.amountBuffer,
      note: recordDraft.note,
      characterName: recordDraft.characterName,
      accountId: recordDraft.accountId,
      fromAccountId: recordDraft.fromAccountId,
      toAccountId: recordDraft.toAccountId,
      feeAmount: recordDraft.feeAmount,
      pendingItemId: recordDraft.pendingItemId,
    };
    renderRecord();
  });
  $('#categoryGrid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    recordDraft.category = button.dataset.category;
    recordDraft.categoryManuallySelected = true;
    recordDraft.autoCategorySource = 'manual';
    renderRecord();
  });
  $('#keypad').addEventListener('click', (event) => {
    const button = event.target.closest('[data-key]');
    if (button) handleKeypad(button.dataset.key);
  });
  $('#keypad').addEventListener('pointerdown', (event) => {
    const button = event.target.closest('[data-key]');
    if (!button) return;
    flashKeypadButton(button);
    playKeypadTap();
  });
  $('#noteInput').addEventListener('input', (event) => {
    recordDraft.note = event.target.value;
    if (!recordDraft.categoryManuallySelected) {
      const inferred = inferCategoryByKeywords(recordDraft.note, activeCategories(), recordDraft.kind);
      if (inferred.category) {
        recordDraft.category = inferred.category;
        recordDraft.autoCategorySource = inferred.source;
      }
    }
    renderRecord();
  });
  $('#accountSelect').addEventListener('change', (event) => {
    recordDraft.accountId = event.target.value;
  });
  $('#fromAccountSelect').addEventListener('change', (event) => {
    recordDraft.fromAccountId = event.target.value;
  });
  $('#toAccountSelect').addEventListener('change', (event) => {
    recordDraft.toAccountId = event.target.value;
  });
  $('#feeAmountInput').addEventListener('input', (event) => {
    recordDraft.feeAmount = event.target.value;
  });
  $('#pendingItemSelect').addEventListener('change', (event) => {
    recordDraft.pendingItemId = event.target.value;
  });
  $('#recordCharacterSelect').addEventListener('change', (event) => {
    recordDraft.characterName = event.target.value;
  });
  $('#saveEntry').addEventListener('click', saveEntry);
  $('#jumpRecord').addEventListener('click', () => setPage('record'));
  $('#entryGroups').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete]');
    if (button) deleteEntry(button.dataset.delete);
  });
  $('#evaluationFeed').addEventListener('click', (event) => {
    const toggleButton = event.target.closest('[data-toggle-evaluation]');
    if (toggleButton) {
      toggleEvaluationCollapse(toggleButton.dataset.toggleEvaluation);
      return;
    }
    const button = event.target.closest('[data-delete]');
    if (button) deleteEntry(button.dataset.delete);
  });
  $('#saveSettings').addEventListener('click', saveSettings);
  $('#fetchModels').addEventListener('click', () => {
    void fetchModels();
  });
  $('#testApiSettings').addEventListener('click', () => {
    void testApiSettings();
  });
  $('#insightPresetText').addEventListener('input', (event) => {
    state.insightPreset = event.target.value;
    saveState();
  });
  $('#insightPresetImport').addEventListener('change', (event) => {
    void importInsightPreset(event.target.files?.[0]);
    event.target.value = '';
  });
  $('#generateInsight').addEventListener('click', () => {
    void generateInsight();
  });
  $('#saveUserProfile').addEventListener('click', saveUserProfile);
  $('#addCategory').addEventListener('click', addCategory);
  $('#categoryEditorList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-category-action]');
    if (!button) return;
    updateCategoryVisibility(button.dataset.categoryId, button.dataset.categoryAction);
  });
  $('#saveBudget').addEventListener('click', saveBudget);
  $('#addCategoryBudget').addEventListener('click', addCategoryBudget);
  $('#budgetList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-category-budget]');
    if (button) deleteCategoryBudget(button.dataset.deleteCategoryBudget);
  });
  $('#addAccount').addEventListener('click', addAccount);
  $('#openPaymentNotificationSettings').addEventListener('click', () => {
    void openPaymentNotificationSettings();
  });
  $('#openPaymentAccessibilitySettings').addEventListener('click', () => {
    void openPaymentAccessibilitySettings();
  });
  $('#savePaymentCaptureSettings').addEventListener('click', () => {
    void savePaymentCaptureSettings();
  });
  $('#loadInstalledApps').addEventListener('click', () => {
    void loadInstalledApps();
  });
  $('#installedAppSearch').addEventListener('input', (event) => {
    installedAppQuery = event.target.value;
    renderInstalledAppPicker();
  });
  $('#installedAppList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-add-installed-app]');
    if (!button) return;
    addInstalledAppToWhitelist(button.dataset.addInstalledApp);
  });
  $('#syncDetectedPayments').addEventListener('click', () => {
    void syncDetectedPayments();
  });
  $('#accountList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-account]');
    if (button) deleteAccount(button.dataset.deleteAccount);
  });
  $('#addPendingItem').addEventListener('click', addPendingItem);
  $('#pendingItemList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-pending]');
    if (button) deletePendingItem(button.dataset.deletePending);
  });
  $('#characterImport').addEventListener('change', (event) => {
    void importCharacterCards(event.target.files);
    event.target.value = '';
  });
  $('#contactList').addEventListener('click', (event) => {
    if (event.target.closest('[data-toggle-character]')) return;
    const card = event.target.closest('[data-contact-id]');
    if (!card) return;
    activeContactId = card.dataset.contactId;
    renderContacts();
  });
  $('#contactList').addEventListener('change', (event) => {
    const input = event.target.closest('[data-toggle-character]');
    if (input) toggleCharacter(input.dataset.toggleCharacter, input.checked);
  });
  $('#contactDetail').addEventListener('click', (event) => {
    const deleteEntryButton = event.target.closest('[data-delete-character-worldbook-entry]');
    if (deleteEntryButton) {
      const bookNode = deleteEntryButton.closest('[data-character-worldbook]');
      if (activeContactId && bookNode) {
        deleteCharacterWorldBookEntry(activeContactId, bookNode.dataset.characterWorldbook, deleteEntryButton.dataset.deleteCharacterWorldbookEntry);
      }
      return;
    }
    const selectButton = event.target.closest('[data-contact-select]');
    if (selectButton) {
      toggleCharacter(selectButton.dataset.contactSelect, true);
      return;
    }
    const saveButton = event.target.closest('[data-save-character]');
    if (saveButton) {
      saveCharacterDetail(saveButton.dataset.saveCharacter);
      return;
    }
    const deleteButton = event.target.closest('[data-delete-character]');
    if (deleteButton) deleteCharacter(deleteButton.dataset.deleteCharacter);
  });
  $('#worldBookImport').addEventListener('change', (event) => {
    void importWorldBooks(event.target.files);
    event.target.value = '';
  });
  $('#saveEvaluationPrompt').addEventListener('click', saveEvaluationPrompt);
  $('#resetEvaluationPrompt').addEventListener('click', resetEvaluationPrompt);
  $('#addWorldBook').addEventListener('click', addWorldBook);
  $('#worldBookList').addEventListener('change', (event) => {
    const input = event.target.closest('[data-toggle-worldbook]');
    if (input) toggleWorldBook(input.dataset.toggleWorldbook, input.checked);
  });
  $('#worldBookList').addEventListener('click', (event) => {
    const deleteEntryButton = event.target.closest('[data-delete-worldbook-entry]');
    if (deleteEntryButton) {
      const bookNode = deleteEntryButton.closest('[data-worldbook-card]');
      if (bookNode) deleteWorldBookEntry(bookNode.dataset.worldbookCard, deleteEntryButton.dataset.deleteWorldbookEntry);
      return;
    }
    const addEntryButton = event.target.closest('[data-add-worldbook-entry]');
    if (addEntryButton) {
      addWorldBookEntry(addEntryButton.dataset.addWorldbookEntry);
      return;
    }
    const saveButton = event.target.closest('[data-save-worldbook]');
    if (saveButton) {
      saveWorldBook(saveButton.dataset.saveWorldbook);
      return;
    }
    const button = event.target.closest('[data-delete-worldbook]');
    if (button) deleteWorldBook(button.dataset.deleteWorldbook);
  });
  $('#clearEntries').addEventListener('click', () => {
    state.entries = [];
    saveState();
    render();
  });
  $('#themePickerButton').addEventListener('click', () => {
    themeSheetOpen = true;
    renderThemeSheet();
  });
  $('#themeSheetClose').addEventListener('click', () => {
    themeSheetOpen = false;
    renderThemeSheet();
  });
  $('#themeSheet').addEventListener('click', (event) => {
    if (event.target === $('#themeSheet')) {
      themeSheetOpen = false;
      renderThemeSheet();
      return;
    }
    const button = event.target.closest('[data-theme-choice]');
    if (button) setLedgerTheme(button.dataset.themeChoice);
  });
  $('#fontSelect').addEventListener('change', (event) => {
    setLedgerFont(event.target.value);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void autoSyncDetectedPayments();
  });
  window.addEventListener('focus', () => {
    void autoSyncDetectedPayments();
  });
}

function render() {
  updateTheme();
  renderShell();
  renderEvaluate();
  renderOverview();
  renderDetails();
  renderCharts(detailScope, detailReferenceTime(), detailView);
  renderRecord();
  renderSettings();
}

bindEvents();
render();
void autoSyncDetectedPayments();