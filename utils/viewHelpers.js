function formatDateLong(d) {
  const dateObj = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dateObj.getTime())) return d || '';
  return dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatDateShort(d) {
  const dateObj = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dateObj.getTime())) return d || '';
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(t) {
  if (!t) return '';
  const [hStr, mStr] = String(t).split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function initials(name) {
  if (!name) return '?';
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

function toDate(d) {
  const dateObj = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dateObj.getTime()) ? null : dateObj;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

module.exports = {
  formatDateLong,
  formatDateShort,
  formatTime,
  initials,
  toDate,
  sameDay
};
// @ts-check
