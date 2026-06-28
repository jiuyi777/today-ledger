import {
  buildBudgetSummary,
  getCategoryBudgetStatus,
} from '../src/domain/budget-core.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
}

const now = new Date('2026-06-20T09:30:00+08:00').getTime();
const entries = [
  { id: 'tea', kind: 'expense', category: '餐饮', amount: 20, createdAt: now },
  { id: 'food', kind: 'expense', category: '餐饮', amount: 80, createdAt: now },
  { id: 'game', kind: 'expense', category: '游戏', amount: 60, createdAt: now },
  { id: 'salary', kind: 'income', category: '工资', amount: 8000, createdAt: now },
  { id: 'transfer', kind: 'transfer', category: '转账', amount: 300, createdAt: now },
  { id: 'old', kind: 'expense', category: '餐饮', amount: 999, createdAt: new Date('2026-05-20T09:30:00+08:00').getTime() },
];

const budgets = {
  monthlyLimit: 200,
  categoryLimits: [
    { category: '餐饮', limit: 100 },
    { category: '游戏', limit: 50 },
  ],
};

const summary = buildBudgetSummary(entries, budgets, now);
equal(summary.monthlyExpense, 160, 'monthly budget only counts current-month expenses');
equal(summary.monthlyLimit, 200, 'monthly limit should be preserved');
equal(summary.remaining, 40, 'remaining budget should subtract current expense');
equal(summary.overLimit, false, 'under monthly budget should not be over limit');
equal(summary.categoryRows.find((row) => row.category === '餐饮').remaining, 0, 'category budget should reach zero');
equal(summary.categoryRows.find((row) => row.category === '游戏').overLimit, true, 'category overrun should be detected');

const categoryStatus = getCategoryBudgetStatus(entries, budgets, '游戏', now);
equal(categoryStatus.spent, 60, 'single category status should total that category');
equal(categoryStatus.remaining, -10, 'single category status should show negative remaining');
assert(categoryStatus.overLimit, 'single category status should flag over limit');

const noBudget = buildBudgetSummary(entries, {}, now);
equal(noBudget.remaining, null, 'missing monthly budget should not invent a remaining amount');
equal(noBudget.overLimit, false, 'missing monthly budget is not over limit');

console.log('budget core ok');
