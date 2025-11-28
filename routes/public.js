const express = require('express');
const db = require('../db');
const { ensureUpcomingJumuahs } = require('./helpers');

const router = express.Router();

function formatDate(d) {
  const dateObj = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dateObj.getTime())) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

router.get('/public/schedule', (req, res) => {
  ensureUpcomingJumuahs(err => {
    if (err) console.error(err);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 21);

    const startStr = formatDate(start);
    const endStr = formatDate(end);

    const sql = `
      SELECT s.*, u.name AS speaker_name, u.avatar_url AS speaker_avatar
      FROM schedules s
      LEFT JOIN users u ON s.speaker_id = u.id
      WHERE s.date BETWEEN ? AND ?
      ORDER BY s.date ASC, s.time ASC
    `;

    db.query(sql, [startStr, endStr], (err2, results) => {
      if (err2) {
        console.error(err2);
        return res.status(500).render('not_found', { title: 'Schedule unavailable' });
      }

      res.render('public_schedule', {
        title: 'Masjid al-Husna | Upcoming Jumuah',
        schedules: results || [],
        dateRange: { start: startStr, end: endStr }
      });
    });
  });
});

module.exports = router;
