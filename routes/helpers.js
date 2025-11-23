const db = require('../db');

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

module.exports = {
  ensureUpcomingJumuahs
};
