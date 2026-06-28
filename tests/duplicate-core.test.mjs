import {
  findDuplicateCandidates,
  isPotentialDuplicate,
} from '../src/domain/duplicate-core.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
}

const today = new Date('2026-06-20T10:00:00+08:00').getTime();
const later = new Date('2026-06-20T18:00:00+08:00').getTime();
const yesterday = new Date('2026-06-19T10:00:00+08:00').getTime();
const existing = [
  { id: 'a', kind: 'expense', category: '餐饮', amount: 18, note: '奶茶', createdAt: today },
  { id: 'b', kind: 'expense', category: '交通', amount: 23, note: '打车', createdAt: today },
  { id: 'c', kind: 'expense', category: '餐饮', amount: 18, note: '奶茶', createdAt: yesterday },
];

assert(isPotentialDuplicate({ kind: 'expense', category: '餐饮', amount: 18, note: '奶茶', createdAt: later }, existing[0]), 'same day amount category and note should duplicate');
assert(!isPotentialDuplicate({ kind: 'expense', category: '餐饮', amount: 19, note: '奶茶', createdAt: later }, existing[0]), 'different amount should not duplicate');
assert(!isPotentialDuplicate({ kind: 'expense', category: '餐饮', amount: 18, note: '奶茶', createdAt: later }, existing[2]), 'different day should not duplicate');

const candidates = findDuplicateCandidates({ kind: 'expense', category: '餐饮', amount: 18, note: '奶茶加冰', createdAt: later }, existing);
equal(candidates.length, 1, 'similar same-day note should return one candidate');
equal(candidates[0].id, 'a', 'duplicate search should return matching entry');

console.log('duplicate core ok');
