export function createDefaultAccounts() {
  return [
    { id: 'wechat', name: '微信', balance: 0 },
    { id: 'bank', name: '银行卡', balance: 0 },
    { id: 'cash', name: '现金', balance: 0 },
    { id: 'other', name: '其他', balance: 0 },
  ];
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function updateBalance(account, delta) {
  return { ...account, balance: money(Number(account.balance || 0) + delta) };
}

export function applyEntryToAccounts(accounts = createDefaultAccounts(), entry = {}) {
  return accounts.map((account) => {
    if (entry.kind === 'expense' && account.id === entry.accountId) {
      return updateBalance(account, -Number(entry.amount || 0));
    }
    if (entry.kind === 'income' && account.id === entry.accountId) {
      return updateBalance(account, Number(entry.amount || 0));
    }
    if (entry.kind === 'transfer' && account.id === entry.fromAccountId) {
      return updateBalance(account, -Number(entry.amount || 0) - Number(entry.feeAmount || 0));
    }
    if (entry.kind === 'transfer' && account.id === entry.toAccountId) {
      return updateBalance(account, Number(entry.amount || 0));
    }
    return account;
  });
}

export function buildFeeEntryForTransfer(entry = {}) {
  const amount = Number(entry.feeAmount || 0);
  if (!amount) return null;
  return {
    id: `fee-${entry.id || Date.now()}`,
    kind: 'expense',
    category: '手续费',
    title: '转账手续费',
    amount,
    note: entry.note ? `转账手续费：${entry.note}` : '转账手续费',
    accountId: entry.fromAccountId || entry.accountId || '',
    relatedEntryId: entry.id || '',
    createdAt: entry.createdAt || Date.now(),
  };
}

export function summarizeAccountFlow(entries = []) {
  return entries.reduce((summary, entry) => {
    if (entry.kind === 'expense') summary.expense += Number(entry.amount || 0);
    else if (entry.kind === 'income') summary.income += Number(entry.amount || 0);
    else if (entry.kind === 'transfer') summary.transfer += Number(entry.amount || 0);
    return summary;
  }, { expense: 0, income: 0, transfer: 0 });
}
