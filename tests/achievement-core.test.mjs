import { strictEqual, ok } from 'node:assert';
import {
  buildAchievements,
  buildCharacterAchievementComments,
} from '../src/domain/achievement-core.mjs';

const entries = [
  { id: 'e1', kind: 'expense', category: '餐饮', title: '餐饮', note: '奶茶', amount: 18, createdAt: new Date('2026-06-02T12:00:00+08:00').getTime() },
  { id: 'e2', kind: 'expense', category: '餐饮', title: '餐饮', note: '外卖', amount: 36, createdAt: new Date('2026-06-03T12:00:00+08:00').getTime() },
  { id: 'e3', kind: 'expense', category: '交通', title: '交通', note: '打车', amount: 23, createdAt: new Date('2026-06-04T12:00:00+08:00').getTime() },
  { id: 'e4', kind: 'income', category: '工资', title: '工资', note: '工资', amount: 3000, createdAt: new Date('2026-06-05T12:00:00+08:00').getTime() },
];

const achievements = buildAchievements(entries, {
  budgets: { monthlyLimit: 2000, categoryLimits: [{ category: '餐饮', limit: 300 }] },
  pendingItems: [{ id: 'p1', status: '进行中' }],
  now: new Date('2026-06-23T12:00:00+08:00').getTime(),
});

strictEqual(achievements.some((item) => item.id === 'first-entry' && item.unlocked), true, 'first entry achievement should unlock');
strictEqual(achievements.find((item) => item.id === 'milk-tea-watch')?.count, 1, 'milk tea achievement should count real matching entries');
strictEqual(achievements.find((item) => item.id === 'traffic-log')?.count, 1, 'traffic achievement should count real traffic entries');
strictEqual(achievements.find((item) => item.id === 'budget-keeper')?.unlocked, true, 'budget achievement should unlock when a monthly budget exists');
strictEqual(achievements.find((item) => item.id === 'pending-tracker')?.count, 1, 'pending achievement should summarize open pending items');

const comments = buildCharacterAchievementComments(
  [
    { id: 'c1', name: '沈金明', enabled: true },
    { id: 'c2', name: '茉尔', enabled: true },
    { id: 'c3', name: '未启用', enabled: false },
  ],
  achievements,
);

strictEqual(comments.length, 2, 'only enabled characters should join achievement comments');
ok(comments.every((item) => !/^\d+[.、]/.test(item.content)), 'achievement comments should not use numbered output');
ok(comments.every((item) => item.content.length <= 42), 'achievement comments should stay short and lively');