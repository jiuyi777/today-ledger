import {
  buildPendingSummary,
  createPendingItem,
  summarizePendingItem,
} from '../src/domain/pending-core.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
}

const medical = createPendingItem({
  title: '医院打光',
  type: 'medical',
  totalAmount: 3000,
  usedAmount: 1500,
  reimbursedAmount: 1500,
  totalCount: 2,
  usedCount: 1,
});
const medicalSummary = summarizePendingItem(medical);
equal(medicalSummary.remainingAmount, 0, 'reimbursed and used amounts should reduce remaining money');
equal(medicalSummary.remainingCount, 1, 'used count should reduce remaining count');
equal(medicalSummary.status, '进行中', 'remaining count keeps item open');

const card = createPendingItem({
  title: '剧本杀年卡',
  type: 'prepaid',
  totalAmount: 1000,
  usedAmount: 828,
});
equal(summarizePendingItem(card).remainingAmount, 172, 'prepaid card should track remaining value');

const finished = createPendingItem({
  title: '两次套餐',
  totalAmount: 200,
  usedAmount: 200,
  totalCount: 2,
  usedCount: 2,
});
equal(summarizePendingItem(finished).status, '已结清', 'zero amount and zero count should close item');

const summary = buildPendingSummary([medical, card, finished]);
equal(summary.openCount, 2, 'pending summary should count open items');
equal(summary.remainingAmount, 172, 'pending summary should total remaining money');
assert(summary.items.every((item) => item.id), 'created pending items should have ids');

console.log('pending core ok');
