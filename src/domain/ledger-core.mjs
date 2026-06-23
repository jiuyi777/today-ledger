export const kinds = {
  expense: '支出',
  income: '收入',
  transfer: '转账',
};

export const defaultEvaluationPrompt = [
  '默认做一句话 RP 短评：角色用自己的口吻，对这笔账随口评价一句。',
  '不要输出编号，不要写分析报告，不要像理财顾问。',
  '可以吐槽、关心、撒娇、嘴硬或冷淡，但必须保持角色感。',
  '只能评价账单真实内容，不能虚构地点、目的、人物、路线、过去习惯或剧情。',
].join('\n');

export const categories = [
  { name: '餐饮', kind: 'expense', icon: 'food', color: '#F2E2C7', keywords: ['饭', '餐', '外卖', '奶茶', '咖啡', '零食', '早餐', '午饭', '晚饭'] },
  { name: '交通', kind: 'expense', icon: 'traffic', color: '#DCE9E2', keywords: ['打车', '地铁', '公交', '车费', '油费', '停车'] },
  { name: '游戏', kind: 'expense', icon: 'game', color: '#E7E4D8', keywords: ['游戏', '电影', '会员', '演出', '娱乐'] },
  { name: '礼物', kind: 'expense', icon: 'gift', color: '#F1DFD7', keywords: ['礼物', '生日', '纪念日', '送'] },
  { name: '购物', kind: 'expense', icon: 'shopping', color: '#E9E2EF', keywords: ['购物', '衣服', '日用品', '数码', '淘宝', '买'] },
  { name: '居住', kind: 'expense', icon: 'home', color: '#EFE8D3', keywords: ['房租', '水电', '物业', '宽带'] },
  { name: '医疗', kind: 'expense', icon: 'medical', color: '#DDEBE8', keywords: ['药', '挂号', '医院', '检查'] },
  { name: '学习工作', kind: 'expense', icon: 'study', color: '#E7EBD8', keywords: ['书', '课程', '软件', '工具', '学习'] },
  { name: '人情往来', kind: 'expense', icon: 'social', color: '#F0D9DF', keywords: ['红包', '请客', '份子钱'] },
  { name: '其他支出', kind: 'expense', icon: 'other', color: '#E4E1D8', keywords: [] },
  { name: '工资', kind: 'income', icon: 'salary', color: '#DDE9DD', keywords: ['工资', '薪水', '发薪'] },
  { name: '兼职', kind: 'income', icon: 'parttime', color: '#DCE9E2', keywords: ['兼职', '稿费', '外快'] },
  { name: '退款', kind: 'income', icon: 'refund', color: '#DCE5EA', keywords: ['退款', '退回', '返现'] },
  { name: '红包收入', kind: 'income', icon: 'redpacket', color: '#F0D9DF', keywords: ['收红包', '红包收入'] },
  { name: '其他收入', kind: 'income', icon: 'income', color: '#E7EBD8', keywords: [] },
  { name: '借出', kind: 'transfer', icon: 'lend', color: '#E3E2EC', keywords: ['借出', '借给'] },
  { name: '还款', kind: 'transfer', icon: 'repay', color: '#EFE8D3', keywords: ['还款', '还钱'] },
  { name: '其他转账', kind: 'transfer', icon: 'transfer', color: '#E4E1D8', keywords: ['转账'] },
];

const defaultCategoryIds = [
  'cat-expense-food',
  'cat-expense-traffic',
  'cat-expense-game',
  'cat-expense-gift',
  'cat-expense-shopping',
  'cat-expense-home',
  'cat-expense-medical',
  'cat-expense-study',
  'cat-expense-social',
  'cat-expense-other',
  'cat-income-salary',
  'cat-income-parttime',
  'cat-income-refund',
  'cat-income-redpacket',
  'cat-income-other',
  'cat-transfer-lend',
  'cat-transfer-repay',
  'cat-transfer-other',
];

export function buildCategoryCatalog(overrides = []) {
  const catalog = categories.map((category, index) => ({
    ...category,
    id: defaultCategoryIds[index] || `cat-${category.kind}-${index}`,
    enabled: true,
    custom: false,
  }));
  const byId = new Map(catalog.map((category) => [category.id, category]));
  for (const override of overrides) {
    if (!override || typeof override !== 'object') continue;
    const id = String(override.id || '').trim() || `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const existing = byId.get(id);
    const next = {
      ...(existing || {
        id,
        name: String(override.name || '').trim(),
        kind: override.kind || 'expense',
        icon: String(override.icon || '').trim() || '+',
        color: override.color || '#E4E1D8',
        keywords: Array.isArray(override.keywords) ? override.keywords : [],
        custom: true,
      }),
      ...override,
      id,
      enabled: override.enabled !== false,
      custom: existing ? Boolean(override.custom) : true,
    };
    if (!next.name) continue;
    byId.set(id, next);
  }
  return [...byId.values()].filter((category) => category.enabled !== false);
}

export function createDefaultLedgerState() {
  return {
    entries: [],
    settings: {
      apiBaseUrl: '',
      apiKey: '',
      apiModel: '',
      apiModels: [],
      evaluationPrompt: defaultEvaluationPrompt,
      characterName: '',
      characterStyle: '',
      theme: 'pastel',
    },
    userProfile: {
      displayName: '凡人歌',
      address: '你',
      spendingStyle: '随性型',
      commentMode: '温柔一点',
      persona: '',
      promptNote: '',
    },
    characters: [],
    worldBooks: [],
    chatMessages: [],
    categoryOverrides: [],
    insightPreset: '',
    lastInsight: null,
  };
}

export function removeBuiltInCharacters(characters = []) {
  return characters.filter((character) => !String(character.id || '').startsWith('default-'));
}

export function removeBuiltInEvaluations(evaluations = []) {
  return evaluations.filter((evaluation) => !String(evaluation.characterId || '').startsWith('default-'));
}

export function formatMoney(value) {
  return `¥${(Number(value) || 0).toFixed(2)}`;
}

export function inferKind(text) {
  if (/(工资|薪水|兼职|稿费|退款|退回|返现|收入|收红包)/.test(text)) return 'income';
  if (/(转账|借出|借给|还款|还钱)/.test(text)) return 'transfer';
  return 'expense';
}

export function inferCategory(text, kind = inferKind(text)) {
  const scoped = categories.filter((category) => category.kind === kind);
  return scoped.find((category) => category.keywords.some((keyword) => text.includes(keyword)))
    || scoped.find((category) => category.name.startsWith('其他'))
    || scoped[0];
}

export function inferDraft(input, now = Date.now()) {
  const text = String(input || '').trim();
  const amountMatch = text.match(/(?:¥|￥|元|rmb|RMB)?\s*(\d+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? Number(amountMatch[1]) : 0;
  const amountIndex = amountMatch?.index ?? text.length;
  const beforeAmount = text.slice(0, amountIndex).replace(/[¥￥元]/g, '').trim();
  const afterAmount = amountMatch ? text.slice(amountIndex + amountMatch[0].length).trim() : '';
  const kind = inferKind(text);
  const category = inferCategory(text, kind);
  return {
    kind,
    category: category.name,
    title: beforeAmount || category.name,
    amount,
    note: afterAmount,
    createdAt: now,
  };
}

function sameDay(a, b) {
  const left = new Date(a);
  const right = new Date(b);
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function sameMonth(a, b) {
  const left = new Date(a);
  const right = new Date(b);
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function sameYear(a, b) {
  const left = new Date(a);
  const right = new Date(b);
  return left.getFullYear() === right.getFullYear();
}

function localDateKey(time) {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(time) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfWeek(time) {
  const date = new Date(startOfDay(time));
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.getTime();
}

function startOfMonth(time) {
  const date = new Date(time);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addDays(time, amount) {
  const date = new Date(time);
  date.setDate(date.getDate() + amount);
  return date.getTime();
}

export function isInPeriod(entryTime, period, now = Date.now()) {
  if (period === 'day') return sameDay(entryTime, now);
  if (period === 'week') return entryTime >= startOfWeek(now) && entryTime < startOfWeek(now) + 7 * 24 * 60 * 60 * 1000;
  return entryTime >= startOfMonth(now) && sameMonth(entryTime, now);
}

export function sortEntries(entries) {
  return [...entries].sort((a, b) => b.createdAt - a.createdAt);
}

export function buildSummary(entries, now = Date.now()) {
  const today = entries.filter((entry) => sameDay(entry.createdAt, now));
  const month = entries.filter((entry) => sameMonth(entry.createdAt, now));
  const todayExpense = today.filter((entry) => entry.kind === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
  const monthExpense = month.filter((entry) => entry.kind === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
  const monthIncome = month.filter((entry) => entry.kind === 'income').reduce((sum, entry) => sum + entry.amount, 0);
  const categoryTotals = new Map();
  for (const entry of month) {
    if (entry.kind !== 'expense') continue;
    categoryTotals.set(entry.category, (categoryTotals.get(entry.category) || 0) + entry.amount);
  }
  const topCategory = [...categoryTotals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)[0] || null;
  return {
    today,
    month,
    todayExpense,
    monthExpense,
    monthIncome,
    balance: monthIncome - monthExpense,
    topCategory,
  };
}

export function buildPeriodSummary(entries, period = 'month', now = Date.now()) {
  const filtered = entries.filter((entry) => isInPeriod(entry.createdAt, period, now));
  const expense = filtered.filter((entry) => entry.kind === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
  const income = filtered.filter((entry) => entry.kind === 'income').reduce((sum, entry) => sum + entry.amount, 0);
  return {
    period,
    entries: filtered,
    expense,
    income,
    balance: income - expense,
  };
}

export function buildScopedSummary(entries, scope = 'month', now = Date.now()) {
  const filtered = entries.filter((entry) => {
    if (scope === 'all') return true;
    if (scope === 'day') return sameDay(entry.createdAt, now);
    if (scope === 'week') return entry.createdAt >= startOfWeek(now) && entry.createdAt < startOfWeek(now) + 7 * 24 * 60 * 60 * 1000;
    if (scope === 'year') return sameYear(entry.createdAt, now);
    return sameMonth(entry.createdAt, now);
  });
  const expense = filtered.filter((entry) => entry.kind === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
  const income = filtered.filter((entry) => entry.kind === 'income').reduce((sum, entry) => sum + entry.amount, 0);
  return {
    scope,
    entries: filtered,
    expense,
    income,
    balance: income - expense,
  };
}

export function buildCategoryBreakdown(entries, period = 'month', now = Date.now(), categoryCatalog = categories) {
  const summary = ['all', 'year'].includes(period)
    ? buildScopedSummary(entries, period, now)
    : buildPeriodSummary(entries, period, now);
  const totals = new Map();
  for (const entry of summary.entries) {
    if (entry.kind !== 'expense') continue;
    totals.set(entry.category, (totals.get(entry.category) || 0) + entry.amount);
  }
  const totalExpense = [...totals.values()].reduce((sum, value) => sum + value, 0) || 1;
  return [...totals.entries()]
    .map(([name, amount]) => {
      const category = categoryCatalog.find((item) => item.name === name) || categories.find((item) => item.name === name);
      return {
        name,
        amount,
        icon: category?.icon || name.slice(0, 1),
        color: category?.color || '#E4E1D8',
        percent: Math.round((amount / totalExpense) * 100),
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function groupEntriesByDay(entries, now = Date.now()) {
  const groups = new Map();
  for (const entry of sortEntries(entries)) {
    const key = localDateKey(entry.createdAt);
    if (!groups.has(key)) {
      const label = new Date(entry.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
      groups.set(key, { key, label, entries: [] });
    }
    groups.get(key).entries.push(entry);
  }
  return [...groups.values()];
}

export function buildCalendarMonth(entries, now = Date.now()) {
  const monthStart = startOfMonth(now);
  const monthStartDate = new Date(monthStart);
  const firstDay = monthStartDate.getDay() || 7;
  const gridStart = addDays(monthStart, -(firstDay - 1));
  const month = monthStartDate.getMonth();
  const year = monthStartDate.getFullYear();
  const nextMonth = new Date(year, month + 1, 1).getTime();
  const daysInGrid = Math.ceil(((nextMonth - gridStart) / 86400000) / 7) * 7;

  return Array.from({ length: daysInGrid }, (_, index) => {
    const time = addDays(gridStart, index);
    const date = new Date(time);
    const dayEntries = entries.filter((entry) => sameDay(entry.createdAt, time));
    const expense = dayEntries.filter((entry) => entry.kind === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
    const income = dayEntries.filter((entry) => entry.kind === 'income').reduce((sum, entry) => sum + entry.amount, 0);
    return {
      key: localDateKey(time),
      day: date.getDate(),
      time,
      isCurrentMonth: date.getFullYear() === year && date.getMonth() === month,
      isToday: sameDay(time, now),
      expense,
      income,
      entryCount: dayEntries.length,
    };
  });
}

const bucketDefinitions = [
  { label: '凌晨', shortLabel: '夜间', icon: '✨', start: 0, end: 6 },
  { label: '清晨', shortLabel: '清晨', icon: '☕', start: 6, end: 10 },
  { label: '上午', shortLabel: '上午', icon: '☀️', start: 10, end: 12 },
  { label: '中午', shortLabel: '中午', icon: '🍱', start: 12, end: 15 },
  { label: '下午', shortLabel: '下午', icon: '🍰', start: 15, end: 19 },
  { label: '晚上', shortLabel: '晚上', icon: '🌙', start: 19, end: 24 },
];

export function buildTimeBuckets(entries, now = Date.now()) {
  const todayEntries = entries.filter((entry) => sameDay(entry.createdAt, now));
  return bucketDefinitions.map((bucket) => {
    const bucketEntries = todayEntries.filter((entry) => {
      const hour = new Date(entry.createdAt).getHours();
      return hour >= bucket.start && hour < bucket.end;
    });
    return {
      ...bucket,
      expense: bucketEntries.filter((entry) => entry.kind === 'expense').reduce((sum, entry) => sum + entry.amount, 0),
      income: bucketEntries.filter((entry) => entry.kind === 'income').reduce((sum, entry) => sum + entry.amount, 0),
      entryCount: bucketEntries.length,
    };
  });
}

export function buildCharacterPrompt({
  characterName,
  entry,
  sameCategoryCount = 1,
  evaluationPrompt = defaultEvaluationPrompt,
}) {
  return [
    `你是${characterName || '角色'}，正在看用户刚保存的一笔记账。`,
    '记账是主功能，你的反应只是附加短评。',
    evaluationPrompt ? `全局评账 Prompt：\n${evaluationPrompt}` : '',
    '只基于账单字段评价这笔账：账单类型、分类、项目、金额、备注、同类次数。',
    '不要虚构地点、目的、同行人、后续安排、过去习惯、交通原因或备注里没有出现的情节。',
    '如果账单信息很少，就只评价金额、分类或备注本身；不知道的内容不要猜。',
    '请回复 1 到 3 句短话，像熟人随口回应，不要像理财顾问，不要写编号，不要替用户决定。',
    `账单类型：${kinds[entry.kind] || entry.kind}`,
    `分类：${entry.category}`,
    `项目：${entry.title}`,
    `金额：${formatMoney(entry.amount)}`,
    entry.note ? `备注：${entry.note}` : '',
    sameCategoryCount > 1 ? `今天同类第 ${sameCategoryCount} 笔。` : '',
  ].filter(Boolean).join('\n');
}

export function parseCharacterCard(rawCard) {
  const card = typeof rawCard === 'string' ? JSON.parse(rawCard) : rawCard;
  if (!card || typeof card !== 'object') {
    throw new Error('角色卡不是有效 JSON');
  }
  const data = card.data && typeof card.data === 'object' ? card.data : card;
  const name = String(data.name || data.char_name || data.character_name || '').trim();
  if (!name) throw new Error('角色卡缺少 name');
  const embeddedBooks = [data.character_book, data.world_info, data.lorebook]
    .filter((book) => book && typeof book === 'object')
    .flatMap((book) => {
      try {
        const parsed = parseWorldBook({ name: book.name || `${name}的角色书`, ...book });
        return [{
          ...parsed,
          source: 'character',
          ownerCharacterName: name,
          embedded: true,
        }];
      } catch {
        return [];
      }
    });
  return {
    id: `char-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    avatar: String(data.avatar || data.avatar_url || data.image || '').trim(),
    description: String(data.description || data.desc || data.scenario || '').trim(),
    personality: String(data.personality || data.persona || data.mes_example || '').trim(),
    greeting: String(data.first_mes || data.firstMessage || data.greeting || '').trim(),
    addressUser: String(data.address_user || '').trim(),
    worldBooks: embeddedBooks,
    enabled: true,
    importedAt: Date.now(),
  };
}

function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}

function decodeBase64(text) {
  if (typeof atob === 'function') {
    const binary = atob(text);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return bytesToText(bytes);
  }
  return Buffer.from(text, 'base64').toString('utf8');
}

export function parseCharacterCardFromPngBytes(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((value, index) => data[index] === value)) {
    throw new Error('这不是有效的 PNG 角色卡');
  }
  let offset = 8;
  while (offset + 8 <= data.length) {
    const length = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0);
    const typeStart = offset + 4;
    const chunkType = bytesToText(data.slice(typeStart, typeStart + 4));
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + length;
    if (chunkEnd > data.length) break;
    if (chunkType === 'tEXt') {
      const chunk = data.slice(chunkStart, chunkEnd);
      const separator = chunk.indexOf(0);
      const keyword = separator >= 0 ? bytesToText(chunk.slice(0, separator)) : '';
      const text = separator >= 0 ? bytesToText(chunk.slice(separator + 1)) : '';
      if (keyword.toLowerCase() === 'chara' && text) {
        return { ...parseCharacterCard(decodeBase64(text)), sourceType: 'png' };
      }
    }
    if (chunkType === 'iTXt') {
      const chunk = data.slice(chunkStart, chunkEnd);
      const keywordEnd = chunk.indexOf(0);
      const keyword = keywordEnd >= 0 ? bytesToText(chunk.slice(0, keywordEnd)) : '';
      if (keyword.toLowerCase() === 'chara') {
        const textStart = findITextPayloadStart(chunk, keywordEnd);
        const text = textStart >= 0 ? bytesToText(chunk.slice(textStart)) : '';
        if (text) return { ...parseCharacterCard(decodeBase64(text)), sourceType: 'png' };
      }
    }
    offset = chunkEnd + 4;
  }
  throw new Error('没有在 PNG 里找到酒馆角色卡数据');
}

export function parseWorldBook(rawBook) {
  const book = typeof rawBook === 'string' ? JSON.parse(rawBook) : rawBook;
  if (!book || typeof book !== 'object') throw new Error('世界书不是有效 JSON');
  const rawEntries = Array.isArray(book.entries)
    ? book.entries
    : Object.values(book.entries || book.data?.entries || {});
  const entries = rawEntries.map((entry, index) => {
    const keys = [
      ...(Array.isArray(entry.key) ? entry.key : []),
      ...(Array.isArray(entry.keys) ? entry.keys : []),
      ...(Array.isArray(entry.keysecondary) ? entry.keysecondary : []),
    ].map((key) => String(key || '').trim()).filter(Boolean);
    return {
      id: String(entry.uid ?? entry.id ?? index),
      title: String(entry.comment || entry.name || entry.title || `条目 ${index + 1}`).trim(),
      keys,
      content: String(entry.content || entry.entry || '').trim(),
      enabled: entry.enabled !== false && entry.disable !== true,
      constant: entry.constant === true,
      order: Number(entry.order ?? index),
    };
  }).filter((entry) => entry.content);
  if (!entries.length) throw new Error('世界书没有可用条目');
  return {
    id: `world-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: String(book.name || book.title || book.display_name || '未命名世界书').trim(),
    entries,
    enabled: true,
    importedAt: Date.now(),
  };
}

export function selectWorldBookEntries(worldBooks = [], context = '', limit = 8) {
  const text = String(context || '').toLowerCase();
  return worldBooks
    .filter((book) => book.enabled !== false)
    .flatMap((book) => (book.entries || []).map((entry) => ({ ...entry, bookName: book.name })))
    .filter((entry) => {
      if (entry.enabled === false) return false;
      if (entry.constant) return true;
      return (entry.keys || []).some((key) => key && text.includes(String(key).toLowerCase()));
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .slice(0, limit);
}

function findITextPayloadStart(chunk, keywordEnd) {
  if (keywordEnd < 0) return -1;
  let cursor = keywordEnd + 3;
  for (let index = 0; index < 2; index += 1) {
    const nextZero = chunk.indexOf(0, cursor);
    if (nextZero < 0) return -1;
    cursor = nextZero + 1;
  }
  return cursor;
}

function pickEvaluationTone(character, entry, userProfile) {
  const name = userProfile?.displayName || userProfile?.nickname || '你';
  const title = entry.title || entry.category;
  const amount = formatMoney(entry.amount);
  if (entry.kind === 'income') {
    return `${name}，这笔${title}进账 ${amount}，账本看起来终于松了口气。`;
  }
  if (entry.kind === 'transfer') {
    return `${name}，${title}这笔 ${amount} 我先记成转账，后面最好别和支出混在一起。`;
  }
  if (entry.amount >= 500) {
    return `${name}，${title}花了 ${amount}，这笔有点重，我建议你晚点再回看一下值不值。`;
  }
  if (/吐槽|严格/.test(userProfile?.commentMode || '') || /吐槽|嘴硬|严格/.test(character.personality || '')) {
    return `${name}，${title} ${amount}，不算离谱，但我会盯着你别一笔一笔滑出去。`;
  }
  return `${name}，${title} ${amount} 已经记好啦，小钱也算数，账本会慢慢变清楚。`;
}

export function buildEntryConversation({ entry, characters = [], userProfile = {}, now = Date.now() }) {
  return characters
    .filter((character) => character.enabled)
    .slice(0, 4)
    .map((character, index) => ({
      id: `eval-${entry.id || now}-${character.id || character.name}-${index}`,
      type: 'character',
      characterId: character.id || character.name,
      characterName: character.name,
      avatar: character.avatar || character.name?.slice(0, 1) || '角',
      content: pickEvaluationTone(character, entry, userProfile),
      createdAt: now + index,
    }));
}
