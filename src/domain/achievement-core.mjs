function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function hasText(entry, words = []) {
  const text = `${entry.category || ''} ${entry.title || ''} ${entry.note || ''}`.toLowerCase();
  return words.some((word) => text.includes(String(word).toLowerCase()));
}

function countEntries(entries, predicate) {
  return entries.filter((entry) => predicate(entry)).length;
}

function uniqueDays(entries) {
  return new Set(entries.map((entry) => new Date(entry.createdAt || Date.now()).toDateString())).size;
}

function topExpenseCategory(entries) {
  const totals = new Map();
  for (const entry of entries) {
    if (entry.kind !== 'expense') continue;
    const category = entry.category || entry.title || '其他支出';
    totals.set(category, money((totals.get(category) || 0) + Number(entry.amount || 0)));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0] || null;
}

export function buildAchievements(entries = [], options = {}) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const expenseEntries = safeEntries.filter((entry) => entry.kind === 'expense');
  const milkTeaCount = countEntries(expenseEntries, (entry) => hasText(entry, ['奶茶']));
  const trafficCount = countEntries(expenseEntries, (entry) => hasText(entry, ['交通', '打车', '地铁', '公交', '车费']));
  const gameCount = countEntries(expenseEntries, (entry) => hasText(entry, ['游戏', '会员', '娱乐']));
  const topCategory = topExpenseCategory(safeEntries);
  const openPending = (options.pendingItems || []).filter((item) => item.status !== '已结清' && item.status !== 'settled').length;
  const monthlyLimit = Number(options.budgets?.monthlyLimit || 0);

  return [
    {
      id: 'first-entry',
      title: '开账成功',
      detail: safeEntries.length ? `已经记下 ${safeEntries.length} 笔真实账` : '记下第一笔账后点亮',
      count: safeEntries.length,
      unlocked: safeEntries.length > 0,
      tone: 'green',
    },
    {
      id: 'milk-tea-watch',
      title: '奶茶雷达',
      detail: milkTeaCount ? `奶茶出现 ${milkTeaCount} 次` : '备注里出现奶茶会自动统计',
      count: milkTeaCount,
      unlocked: milkTeaCount > 0,
      tone: 'pink',
    },
    {
      id: 'traffic-log',
      title: '移动轨迹',
      detail: trafficCount ? `交通类 ${trafficCount} 次` : '打车、地铁、公交会进入这里',
      count: trafficCount,
      unlocked: trafficCount > 0,
      tone: 'blue',
    },
    {
      id: 'game-signal',
      title: '娱乐信号',
      detail: gameCount ? `游戏娱乐 ${gameCount} 次` : '游戏和会员会被看见',
      count: gameCount,
      unlocked: gameCount > 0,
      tone: 'yellow',
    },
    {
      id: 'budget-keeper',
      title: '预算守门',
      detail: monthlyLimit ? `本月预算 ${money(monthlyLimit).toFixed(2)}` : '设置本月预算后点亮',
      count: monthlyLimit,
      unlocked: monthlyLimit > 0,
      tone: 'green',
    },
    {
      id: 'pending-tracker',
      title: '找补清单',
      detail: openPending ? `${openPending} 项待结清还在进行` : '有待结清事项会显示',
      count: openPending,
      unlocked: openPending > 0,
      tone: 'blue',
    },
    {
      id: 'steady-days',
      title: '连续观察',
      detail: uniqueDays(safeEntries) ? `记录覆盖 ${uniqueDays(safeEntries)} 天` : '多记几天会更有感觉',
      count: uniqueDays(safeEntries),
      unlocked: uniqueDays(safeEntries) >= 3,
      tone: 'pink',
    },
    {
      id: 'top-category',
      title: '本期主角',
      detail: topCategory ? `${topCategory[0]} 花了 ${topCategory[1].toFixed(2)}` : '有支出后会出现最高分类',
      count: topCategory?.[1] || 0,
      unlocked: Boolean(topCategory),
      tone: 'yellow',
    },
  ];
}

export function buildCharacterAchievementComments(characters = [], achievements = []) {
  const enabled = characters.filter((character) => character.enabled);
  const unlocked = achievements.filter((item) => item.unlocked);
  const focus = unlocked.find((item) => item.count > 0) || unlocked[0];
  return enabled.map((character, index) => {
    const name = character.name || '角色';
    const line = focus
      ? [
        `${name}盯着“${focus.title}”，觉得这账本开始有生活声了。`,
        `${name}看完“${focus.title}”，只留一句：这笔笔都是真的，挺好。`,
        `${name}对“${focus.title}”点点头，今天的账有东西可聊。`,
      ][index % 3]
      : `${name}等你多记几笔，再来凑热闹评价账本。`;
    return {
      characterId: character.id || `character-${index}`,
      characterName: name,
      content: line.slice(0, 42),
    };
  });
}