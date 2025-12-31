function parseFlag(value) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

const readOnlyMode = parseFlag(process.env.DISABLE_EDITING);

module.exports = {
  readOnlyMode
};
