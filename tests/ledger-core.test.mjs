import {
  buildCalendarMonth,
  buildCategoryCatalog,
  buildCharacterPrompt,
  buildCategoryBreakdown,
  buildEntryConversation,
  buildPeriodSummary,
  buildScopedSummary,
  buildSummary,
  createDefaultLedgerState,
  formatMoney,
  groupEntriesByDay,
  inferDraft,
  parseCharacterCard,
  parseCharacterCardFromPngBytes,
  parseWorldBook,
  removeBuiltInCharacters,
  removeBuiltInEvaluations,
  selectWorldBookEntries,
  sortEntries,
} from '../src/domain/ledger-core.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

const now = new Date('2026-06-20T09:30:00+08:00').getTime();

const tea = inferDraft('奶茶18', now);
equal(tea.kind, 'expense', 'milk tea should be expense');
equal(tea.category, '餐饮', 'milk tea should be food');
equal(tea.title, '奶茶', 'amount should be removed from title');
equal(tea.amount, 18, 'compact amount should parse');

const salary = inferDraft('工资 8000', now);
equal(salary.kind, 'income', 'salary should be income');
equal(salary.category, '工资', 'salary category should match');

const gift = inferDraft('给阿芙买礼物 168 生日', now);
equal(gift.kind, 'expense', 'gift should be expense');
equal(gift.category, '礼物', 'gift should beat generic shopping keyword');
equal(gift.note, '生日', 'text after amount should become note');

const entries = [
  { id: 'a', kind: 'expense', category: '餐饮', amount: 18, title: '奶茶', createdAt: now },
  { id: 'b', kind: 'expense', category: '交通', amount: 32, title: '打车', createdAt: now },
  { id: 'c', kind: 'income', category: '工资', amount: 8000, title: '工资', createdAt: now },
  { id: 'e', kind: 'expense', category: '购物', amount: 99, title: '耳机', createdAt: new Date('2026-06-05T12:00:00+08:00').getTime() },
  { id: 'd', kind: 'expense', category: '娱乐', amount: 60, title: '电影', createdAt: new Date('2026-05-20T12:00:00+08:00').getTime() },
];

const summary = buildSummary(entries, now);
equal(summary.todayExpense, 50, 'today expense should total same-day expenses');
equal(summary.monthExpense, 149, 'month expense should ignore previous month');
equal(summary.monthIncome, 8000, 'month income should total same-month income');
equal(summary.balance, 7851, 'balance should be income minus expense');
equal(summary.topCategory.name, '购物', 'top category should be largest expense category');

equal(formatMoney(18), '¥18.00', 'money should format with yuan symbol');
equal(sortEntries(entries)[0].id, 'a', 'newest same-time stable sort keeps input order');

const grouped = groupEntriesByDay(entries, now);
assert(/6.*20/.test(grouped[0].label), 'day group should use a fixed month-day label');
equal(grouped[0].entries.length, 3, 'today group should contain same-day entries');

const daySummary = buildPeriodSummary(entries, 'day', now);
equal(daySummary.expense, 50, 'day summary should include same-day expenses');
equal(daySummary.income, 8000, 'day summary should include same-day income');

const weekSummary = buildPeriodSummary(entries, 'week', now);
equal(weekSummary.expense, 50, 'week summary should include current week expenses');

const monthBreakdown = buildCategoryBreakdown(entries, 'month', now);
equal(monthBreakdown[0].name, '购物', 'breakdown should sort by amount');
equal(monthBreakdown[0].percent, 66, 'breakdown should round category percent');

const calendar = buildCalendarMonth(entries, now);
equal(calendar.length, 35, 'June 2026 calendar should render five full weeks');
equal(calendar[0].day, 1, 'calendar should start with June 1 on Monday');
equal(calendar[0].isCurrentMonth, true, 'first visible day should be in current month');
equal(calendar[19].day, 20, 'selected date should be in the calendar');
equal(calendar[19].expense, 50, 'selected date should aggregate daily expense');
equal(calendar[19].income, 8000, 'selected date should aggregate daily income');
equal(calendar[19].isToday, true, 'selected date should mark today');

const allScope = buildScopedSummary(entries, 'all', now);
equal(allScope.entries.length, 5, 'all scope should include every entry');
equal(allScope.expense, 209, 'all scope should include previous month expense');

const dayScope = buildScopedSummary(entries, 'day', now);
equal(dayScope.entries.length, 3, 'day scope should include selected day entries');
equal(dayScope.expense, 50, 'day scope should total selected day expenses');

const weekScope = buildScopedSummary(entries, 'week', now);
equal(weekScope.entries.length, 3, 'week scope should include current week entries');
equal(weekScope.income, 8000, 'week scope should total current week income');

const monthScope = buildScopedSummary(entries, 'month', now);
equal(monthScope.entries.length, 4, 'month scope should include current month only');
equal(monthScope.expense, 149, 'month scope should total current month expense');

const yearScope = buildScopedSummary(entries, 'year', now);
equal(yearScope.entries.length, 5, 'year scope should include same-year entries');
equal(yearScope.expense, 209, 'year scope should total same-year expense');

const prompt = buildCharacterPrompt({
  characterName: '阿芙',
  entry: { kind: 'expense', category: '礼物', amount: 168, title: '礼物', note: '生日' },
  sameCategoryCount: 2,
});
assert(prompt.includes('账单类型：支出'), 'prompt should include kind');
assert(prompt.includes('阿芙'), 'prompt should include character');
assert(prompt.includes('不要像理财顾问'), 'prompt should keep role as add-on');
assert(prompt.includes('只基于账单字段'), 'prompt should forbid adding facts outside the saved entry');
assert(prompt.includes('不要虚构地点'), 'prompt should forbid invented places or purposes');

const promptState = createDefaultLedgerState();
assert(promptState.settings.evaluationPrompt.includes('一句话'), 'default evaluation prompt should be visible and editable from settings');
assert(promptState.settings.evaluationPrompt.includes('RP'), 'default evaluation prompt should preserve roleplay intent');

const tavernCard = parseCharacterCard({
  spec: 'chara_card_v2',
  data: {
    name: '阿芙',
    description: '嘴硬心软，会认真看用户花销。',
    personality: '会吐槽，但不会替用户决定。',
    first_mes: '账单拿来，我看看。',
    avatar: 'data:image/png;base64,abc',
    character_book: {
      name: '阿芙的账本记忆',
      entries: {
        0: { comment: '奶茶', key: ['奶茶'], content: '看到奶茶时会轻轻吐槽。' },
      },
    },
  },
});
equal(tavernCard.name, '阿芙', 'character card should parse v2 name');
equal(tavernCard.description, '嘴硬心软，会认真看用户花销。', 'character card should parse description');
equal(tavernCard.greeting, '账单拿来，我看看。', 'character card should parse first message');
equal(tavernCard.enabled, true, 'imported character should join evaluation by default');
assert(Array.isArray(tavernCard.worldBooks), 'character card should keep embedded world books');
equal(tavernCard.worldBooks[0].name, '阿芙的账本记忆', 'embedded character book should keep its name');
equal(tavernCard.worldBooks[0].source, 'character', 'embedded character book should be scoped to the character');
equal(tavernCard.worldBooks[0].entries[0].content, '看到奶茶时会轻轻吐槽。', 'embedded character book entries should be editable data');

const plainCard = parseCharacterCard({
  name: '小夏',
  persona: '温柔鼓励型',
  scenario: '陪用户记账',
});
equal(plainCard.name, '小夏', 'plain card should parse name');
equal(plainCard.personality, '温柔鼓励型', 'plain card should parse persona');

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, Buffer.from(type), data, Buffer.alloc(4)]);
}

const pngCard = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  pngChunk('tEXt', Buffer.from(`chara\0${Buffer.from(JSON.stringify({ data: { name: 'PNG角色', description: '藏在图片里的卡' } })).toString('base64')}`)),
  pngChunk('IEND', Buffer.alloc(0)),
]);
const parsedPngCard = parseCharacterCardFromPngBytes(pngCard);
equal(parsedPngCard.name, 'PNG角色', 'png character card should parse embedded chara data');
equal(parsedPngCard.description, '藏在图片里的卡', 'png character card should keep embedded description');
equal(parsedPngCard.sourceType, 'png', 'png character card should mark source type');

const worldBook = parseWorldBook({
  name: '省钱世界书',
  entries: {
    0: { comment: '奶茶提醒', key: ['奶茶', '饮料'], content: '奶茶连续出现时，要轻轻提醒频率。', enabled: true },
    1: { comment: '禁用条目', key: ['游戏'], content: '不应该出现', enabled: false },
    2: { comment: '常驻规则', key: [], content: '评价要短，不要说教。', constant: true },
  },
});
equal(worldBook.name, '省钱世界书', 'world book should parse name');
equal(worldBook.entries.length, 3, 'world book should parse object entries');

const matchedWorldInfo = selectWorldBookEntries([worldBook], '今天买了奶茶 18');
equal(matchedWorldInfo.length, 2, 'world book selection should include matched and constant entries');
assert(matchedWorldInfo.some((entry) => entry.content.includes('奶茶连续出现')), 'world book selection should include keyword match');
assert(!matchedWorldInfo.some((entry) => entry.content.includes('不应该出现')), 'world book selection should skip disabled entries');

const conversation = buildEntryConversation({
  entry: { kind: 'expense', category: '餐饮', amount: 18, title: '奶茶', note: '' },
  characters: [
    { id: 'a', name: '阿芙', enabled: true, personality: '会吐槽', avatar: 'A' },
    { id: 'b', name: '小夏', enabled: false, personality: '温柔', avatar: 'X' },
  ],
  userProfile: { displayName: '凡人歌', spendingStyle: '随性型', commentMode: '吐槽一点' },
  now,
});
equal(conversation.length, 1, 'conversation should only use enabled characters');
equal(conversation[0].characterName, '阿芙', 'conversation should keep character identity');
assert(conversation[0].content.includes('奶茶'), 'conversation should mention entry title');
assert(conversation[0].content.includes('凡人歌'), 'conversation should mention user profile');

const emptyState = createDefaultLedgerState();
equal(emptyState.characters.length, 0, 'new app state should not include default characters');
assert(Array.isArray(emptyState.categoryOverrides), 'new app state should store category customizations');

const customCatalog = buildCategoryCatalog([
  { id: 'cat-expense-ai', name: 'AI', kind: 'expense', icon: 'AI', color: '#D9E8F6', keywords: ['api'] },
  { id: 'cat-expense-food', enabled: false },
]);
assert(customCatalog.some((category) => category.name === 'AI'), 'custom catalog should include added categories');
assert(!customCatalog.some((category) => category.id === 'cat-expense-food'), 'disabled default categories should be hidden');
equal(customCatalog.find((category) => category.name === 'AI').icon, 'AI', 'custom category icon should be preserved');

const cleanedCharacters = removeBuiltInCharacters([
  { id: 'default-afu', name: '阿芙' },
  { id: 'imported-1', name: '导入角色' },
]);
equal(cleanedCharacters.length, 1, 'old built-in characters should be removed from saved state');
equal(cleanedCharacters[0].name, '导入角色', 'imported characters should be preserved');

const cleanedEvaluations = removeBuiltInEvaluations([
  { characterId: 'default-afu', characterName: '阿芙', content: '旧默认评价' },
  { characterId: 'imported-1', characterName: '导入角色', content: '保留评价' },
]);
equal(cleanedEvaluations.length, 1, 'old built-in evaluations should be removed');
equal(cleanedEvaluations[0].content, '保留评价', 'imported character evaluations should be preserved');

console.log('standalone ledger core ok');
