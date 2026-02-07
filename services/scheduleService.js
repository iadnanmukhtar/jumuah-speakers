// @ts-check
const db = require('../db');
const { toDate, sameDay } = require('../utils/viewHelpers');
/** @typedef {import('../types').Schedule} Schedule */

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ensureUpcomingJumuahs(callback) {
  const weeksAhead = 12;
  const now = new Date();
  const todayStr = formatDate(now);

  // Auto-generate Friday slots up to 12 weeks out so schedules are always present.
  const end = new Date(now);
  end.setDate(end.getDate() + weeksAhead * 7);

  db.query(
    `SELECT date, time FROM schedules WHERE date >= ?`,
    [todayStr],
    (err, results) => {
      if (err) return callback(err);

      const existing = new Set();
      (results || []).forEach(r => {
        const dateStr = r.date instanceof Date ? formatDate(r.date) : String(r.date);
        existing.add(`${dateStr}|${r.time}`);
      });

      const toInsert = [];
      const times = ['14:00', '14:45'];

      const current = new Date(now);
      current.setHours(0, 0, 0, 0);

      while (current <= end) {
        if (current.getDay() === 5) {
          const dateStr = formatDate(current);
          times.forEach(t => {
            const key = `${dateStr}|${t}`;
            if (!existing.has(key)) toInsert.push({ date: dateStr, time: t });
          });
        }
        current.setDate(current.getDate() + 1);
      }

      if (toInsert.length === 0) return callback(null);

      let remaining = toInsert.length;
      toInsert.forEach(s => {
        db.query(
          `INSERT INTO schedules (date, time, topic, notes, status)
           VALUES (?, ?, '', '', 'open')`,
          [s.date, s.time],
          err2 => {
            if (err2) console.error('Error inserting auto schedule', err2);
            remaining -= 1;
            if (remaining === 0) callback(null);
          }
        );
      });
    }
  );
}

function getDateRange(daysAhead) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);

  return {
    start,
    end,
    startStr: start.toISOString().split('T')[0],
    endStr: end.toISOString().split('T')[0]
  };
}

function fetchSchedules({ startStr, endStr, limit }) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT s.*, u.name AS speaker_name, u.avatar_url AS speaker_avatar
      FROM schedules s
      LEFT JOIN users u ON s.speaker_id = u.id
      WHERE s.date BETWEEN ? AND ?
      ORDER BY s.date ASC, s.time ASC
      ${limit ? 'LIMIT ?' : ''}
    `;

    const params = limit ? [startStr, endStr, limit] : [startStr, endStr];

    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results || []);
    });
  });
}

async function getUpcomingSchedules(daysAhead = 21, limit) {
  await new Promise(resolve => ensureUpcomingJumuahs(() => resolve()));
  const range = getDateRange(daysAhead);
  const schedules = await fetchSchedules({ ...range, limit });
  return { schedules, range };
}

function partitionUpcoming(schedules) {
  if (!schedules || schedules.length === 0) {
    return { upcomingSlots: [], remaining: [], earliestDate: null, cutoff: null };
  }

  const earliestDate = toDate(schedules[0].date);
  const upcomingSlots = schedules
    .filter(s => sameDay(toDate(s.date), earliestDate))
    .sort((a, b) => (a.time && b.time ? a.time.localeCompare(b.time) : 0));

  const cutoff = (() => {
    if (!earliestDate) return null;
    const copy = new Date(earliestDate);
    copy.setDate(copy.getDate() + 14);
    return copy;
  })();

  const remaining = schedules.filter(s => {
    const d = toDate(s.date);
    if (!d || !earliestDate) return false;
    if (sameDay(d, earliestDate)) return false;
    if (!cutoff) return true;
    return d <= cutoff;
  });

  return { upcomingSlots, remaining, earliestDate, cutoff };
}

module.exports = {
  ensureUpcomingJumuahs,
  getUpcomingSchedules,
  partitionUpcoming
};
