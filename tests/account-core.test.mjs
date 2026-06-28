import {
  applyEntryToAccounts,
  buildFeeEntryForTransfer,
  createDefaultAccounts,
  summarizeAccountFlow,
} from '../src/domain/account-core.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
}

const accounts = createDefaultAccounts();
assert(accounts.some((account) => account.name === '微信'), 'default accounts should include WeChat');
assert(accounts.some((account) => account.name === '银行卡'), 'default accounts should include bank card');

const seeded = accounts.map((account) => ({ ...account, balance: account.name === '微信' ? 100 : account.name === '银行卡' ? 500 : 0 }));
const afterExpense = applyEntryToAccounts(seeded, {
  kind: 'expense',
  amount: 25,
  accountId: 'wechat',
});
equal(afterExpense.find((account) => account.id === 'wechat').balance, 75, 'expense should reduce selected account');

const afterIncome = applyEntryToAccounts(seeded, {
  kind: 'income',
  amount: 200,
  accountId: 'bank',
});
equal(afterIncome.find((account) => account.id === 'bank').balance, 700, 'income should increase selected account');

const afterTransfer = applyEntryToAccounts(seeded, {
  kind: 'transfer',
  amount: 120,
  fromAccountId: 'bank',
  toAccountId: 'wechat',
});
equal(afterTransfer.find((account) => account.id === 'bank').balance, 380, 'transfer should subtract from source');
equal(afterTransfer.find((account) => account.id === 'wechat').balance, 220, 'transfer should add to target');

const fee = buildFeeEntryForTransfer({
  id: 'transfer-1',
  kind: 'transfer',
  amount: 120,
  feeAmount: 3,
  fromAccountId: 'bank',
  createdAt: 1000,
});
equal(fee.kind, 'expense', 'transfer fee should become expense');
equal(fee.category, '手续费', 'transfer fee should use fee category');
equal(fee.amount, 3, 'transfer fee should preserve amount');
equal(fee.accountId, 'bank', 'transfer fee should use source account');

const flow = summarizeAccountFlow([
  { kind: 'expense', amount: 25 },
  { kind: 'income', amount: 200 },
  { kind: 'transfer', amount: 120 },
  fee,
]);
equal(flow.expense, 28, 'expense total should include fee and normal expense');
equal(flow.income, 200, 'income total should include income');
equal(flow.transfer, 120, 'transfer total should be separate');

console.log('account core ok');
