export function normalizeKeywordList(value = '') {
  const parts = Array.isArray(value)
    ? value
    : String(value).split(/[,\s，、]+/);
  return [...new Set(parts.map((item) => String(item).trim()).filter(Boolean))];
}

export function inferCategoryByKeywords(text = '', catalog = [], kind = 'expense', manualCategory = '') {
  if (manualCategory) return { category: manualCategory, source: 'manual', keyword: '' };
  const scoped = catalog.filter((category) => category.kind === kind);
  const sourceText = String(text || '').toLowerCase();
  for (const category of scoped) {
    for (const keyword of normalizeKeywordList(category.keywords || [])) {
      if (keyword && sourceText.includes(String(keyword).toLowerCase())) {
        return { category: category.name, source: 'keyword', keyword };
      }
    }
  }
  const fallback = scoped.find((category) => String(category.name).includes('其他')) || scoped[0];
  return { category: fallback?.name || '', source: 'fallback', keyword: '' };
}
