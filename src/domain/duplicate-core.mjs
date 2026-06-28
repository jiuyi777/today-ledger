function sameDay(leftTime, rightTime) {
  const left = new Date(leftTime);
  const right = new Date(rightTime);
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function normalize(text = '') {
  return String(text).replace(/\s+/g, '').toLowerCase();
}

function similarNote(left = '', right = '') {
  const a = normalize(left);
  const b = normalize(right);
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export function isPotentialDuplicate(entry = {}, existing = {}) {
  return entry.kind === existing.kind
    && Number(entry.amount || 0) === Number(existing.amount || 0)
    && entry.category === existing.category
    && sameDay(entry.createdAt, existing.createdAt)
    && similarNote(entry.note || entry.title || '', existing.note || existing.title || '');
}

export function findDuplicateCandidates(entry = {}, entries = []) {
  return entries.filter((existing) => existing.id !== entry.id && isPotentialDuplicate(entry, existing));
}
