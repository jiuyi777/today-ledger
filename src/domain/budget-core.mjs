function sameMonth(leftTime, rightTime) {
  const left = new Date(leftTime);
  const right = new Date(rightTime);
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function currentMonthExpenses(entries = [], now = Date.now()) {
  return entries.filter((entry) => (
    entry?.kind === 'expense' && sameMonth(entry.createdAt, now)
  ));
}

export function getCategoryBudgetStatus(entries = [], budgets = {}, category = '', now = Date.now()) {
  const limitRow = (budgets.categoryLimits || []).find((item) => item.category === category);
  const limit = Number(limitRow?.limit || 0);
  const spent = money(currentMonthExpenses(entries, now)
    .filter((entry) => entry.category === category)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
  return {
    category,
    limit,
    spent,
    remaining: limit ? money(limit - spent) : null,
    overLimit: Boolean(limit && spent > limit),
  };
}

export function buildBudgetSummary(entries = [], budgets = {}, now = Date.now()) {
  const monthlyExpense = money(currentMonthExpenses(entries, now)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
  const monthlyLimit = Number(budgets.monthlyLimit || 0);
  const categoryRows = (budgets.categoryLimits || [])
    .filter((item) => item?.category && Number(item.limit || 0) > 0)
    .map((item) => getCategoryBudgetStatus(entries, budgets, item.category, now));
  return {
    monthlyLimit,
    monthlyExpense,
    remaining: monthlyLimit ? money(monthlyLimit - monthlyExpense) : null,
    overLimit: Boolean(monthlyLimit && monthlyExpense > monthlyLimit),
    categoryRows,
  };
}
