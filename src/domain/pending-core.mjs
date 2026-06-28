function makeId() {
  return `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function number(value) {
  return Math.max(0, Number(value || 0));
}

export function createPendingItem(input = {}) {
  const now = Date.now();
  return {
    id: input.id || makeId(),
    title: String(input.title || '').trim() || '待结清事项',
    type: input.type || 'other',
    totalAmount: number(input.totalAmount),
    usedAmount: number(input.usedAmount),
    reimbursedAmount: number(input.reimbursedAmount),
    totalCount: number(input.totalCount),
    usedCount: number(input.usedCount),
    note: String(input.note || ''),
    status: input.status || '进行中',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

export function summarizePendingItem(item = {}) {
  const remainingAmount = Math.max(0, number(item.totalAmount) - number(item.usedAmount) - number(item.reimbursedAmount));
  const remainingCount = Math.max(0, number(item.totalCount) - number(item.usedCount));
  const hasCount = number(item.totalCount) > 0;
  const open = remainingAmount > 0 || (hasCount && remainingCount > 0);
  return {
    ...item,
    remainingAmount,
    remainingCount,
    status: open ? '进行中' : '已结清',
  };
}

export function buildPendingSummary(items = []) {
  const summarized = items.map(summarizePendingItem);
  return {
    items: summarized,
    openCount: summarized.filter((item) => item.status !== '已结清').length,
    remainingAmount: summarized.reduce((sum, item) => sum + item.remainingAmount, 0),
    remainingCount: summarized.reduce((sum, item) => sum + item.remainingCount, 0),
  };
}
