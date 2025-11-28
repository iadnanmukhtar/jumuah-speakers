const db = require('../db');
const { ensureUpcomingJumuahs } = require('../routes/helpers');
const { toDate, sameDay } = require('../utils/viewHelpers');

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
  getUpcomingSchedules,
  partitionUpcoming
};
