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

function digitsOnly(input) {
  if (!input) return '';
  return String(input).replace(/\D/g, '');
}

function phoneVariants(input) {
// @ts-check

// Generate digit-only variants with and without country code to match common user input.
  const digits = digitsOnly(input);
  if (!digits) return [];

  const variants = new Set();
  variants.add(digits);

  if (digits.length === 10) {
    variants.add(`1${digits}`);
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    variants.add(digits.slice(1));
  }

  return Array.from(variants);
}

module.exports = {
  normalizePhone,
  digitsOnly,
  phoneVariants
};
