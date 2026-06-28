import {
  inferCategoryByKeywords,
  normalizeKeywordList,
} from '../src/domain/category-rules.mjs';

function equal(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
}

const catalog = [
  { name: '餐饮', kind: 'expense', keywords: ['奶茶', '外卖', '咖啡'] },
  { name: '交通', kind: 'expense', keywords: ['打车', '地铁'] },
  { name: '工资', kind: 'income', keywords: ['工资'] },
  { name: '其他支出', kind: 'expense', keywords: [] },
];

equal(inferCategoryByKeywords('今天奶茶 18', catalog, 'expense').category, '餐饮', 'milk tea note should infer food');
equal(inferCategoryByKeywords('打车去公司 23', catalog, 'expense').category, '交通', 'taxi note should infer traffic');
equal(inferCategoryByKeywords('工资 8000', catalog, 'income').category, '工资', 'income note should infer salary');
equal(inferCategoryByKeywords('今天奶茶 18', catalog, 'expense', '交通').category, '交通', 'manual category should win');
equal(inferCategoryByKeywords('今天奶茶 18', catalog, 'expense', '交通').source, 'manual', 'manual source should be marked');
equal(inferCategoryByKeywords('未知 12', catalog, 'expense').category, '其他支出', 'unknown expense should fall back to other expense');
equal(normalizeKeywordList('奶茶，外卖, 咖啡  奶茶').join('|'), '奶茶|外卖|咖啡', 'keyword input should be deduped');

console.log('category rules ok');
