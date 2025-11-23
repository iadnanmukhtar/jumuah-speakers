function normalizePhone(input) {
  if (!input) return '';
  const stripped = String(input).trim().replace(/[\s()-]/g, '');
  if (!stripped) return '';

  if (stripped.startsWith('+')) {
    return stripped;
  }

  const digits = stripped.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return digits.startsWith('1') ? `+${digits}` : `+${digits}`;
}

module.exports = {
  normalizePhone
};
