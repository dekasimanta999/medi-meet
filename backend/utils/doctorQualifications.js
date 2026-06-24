const MAX_QUALIFICATIONS = 20;
const MAX_QUALIFICATION_LENGTH = 120;

const parseQualificationValue = (value) => {
  if (value === undefined || value === null) return [];

  if (Array.isArray(value)) {
    return value.flatMap(parseQualificationValue);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseQualificationValue(parsed);
      } catch {
        return [trimmed];
      }
    }

    return [trimmed];
  }

  return [];
};

const normaliseQualifications = (value) => {
  const seen = new Set();
  const cleaned = [];

  for (const item of parseQualificationValue(value)) {
    const qualification = String(item).replace(/\s+/g, ' ').trim().slice(0, MAX_QUALIFICATION_LENGTH);
    const key = qualification.toLowerCase();

    if (!qualification || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(qualification);

    if (cleaned.length >= MAX_QUALIFICATIONS) break;
  }

  return cleaned;
};

const appendQualifications = (existing, incoming) => {
  const current = normaliseQualifications(existing);
  const seen = new Set(current.map((item) => item.toLowerCase()));

  for (const qualification of normaliseQualifications(incoming)) {
    const key = qualification.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    current.push(qualification);

    if (current.length >= MAX_QUALIFICATIONS) break;
  }

  return current;
};

module.exports = {
  normaliseQualifications,
  appendQualifications,
};
