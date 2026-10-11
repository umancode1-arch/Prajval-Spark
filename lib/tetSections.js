export function normalizeTetSection(section) {
  const normalized = String(section || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (normalized === 'cdp' || normalized.includes('child development') || normalized.includes('pedagogy')) {
    return 'Child Development and Pedagogy';
  }
  if (normalized.includes('telugu') || /\blanguage (?:i|1)\b/.test(normalized)) {
    return 'Telugu';
  }
  if (normalized.includes('english') || /\blanguage (?:ii|2)\b/.test(normalized) || normalized.includes('content and methodology')) {
    return 'English';
  }
  return section;
}
