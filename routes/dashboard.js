const express = require('express');
const db = require('../db');
const { ensureAuthenticated } = require('../middleware/auth');
const { ensureUpcomingJumuahs } = require('./helpers');
const { notifySpeaker, notifyAdmin } = require('../notify');

const router = express.Router();

router.get('/dashboard', ensureAuthenticated, (req, res) => {
  const userId = req.session.user.id;

  ensureUpcomingJumuahs(err => {
    if (err) console.error(err);

    const sql = `
      SELECT s.*, u.name AS speaker_name
      FROM schedules s
      LEFT JOIN users u ON s.speaker_id = u.id
      WHERE s.speaker_id = ?
      ORDER BY s.date ASC, s.time ASC
    `;

    db.query(sql, [userId], (err2, results) => {
      if (err2) {
        console.error(err2);
        req.session.flash = { type: 'error', message: 'Error loading dashboard.' };
        return res.redirect('/');
      }

      res.render('dashboard', {
        title: 'Masjid al-Husna | My Jumuah Commitments',
        schedules: results || []
      });
    });
  });
});

router.get('/schedules', ensureAuthenticated, (req, res) => {
  ensureUpcomingJumuahs(err => {
    if (err) {
      console.error(err);
      req.session.flash = { type: 'error', message: 'Error generating schedules.' };
    }

    const sql = `
      SELECT s.*, u.name AS speaker_name
      FROM schedules s
      LEFT JOIN users u ON s.speaker_id = u.id
      ORDER BY s.date ASC, s.time ASC
    `;

    db.query(sql, [], (err2, results) => {
      if (err2) {
        console.error(err2);
        req.session.flash = { type: 'error', message: 'Error loading schedules.' };
        return res.redirect('/dashboard');
      }

      res.render('schedules', {
        title: 'Masjid al-Husna | All Jumuah Schedules',
        schedules: results || []
      });
    });
  });
});

// Opt-in
router.post('/schedules/:id/opt-in', ensureAuthenticated, (req, res) => {
  const scheduleId = req.params.id;
  const user = req.session.user;
  const topicInput = (req.body.topic || '').trim();

  db.query(
    `SELECT * FROM schedules WHERE id = ? LIMIT 1`,
    [scheduleId],
    (err, results) => {
      const schedule = results && results[0];
      if (err || !schedule) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Schedule not found.' };
        return res.redirect('/schedules');
      }

      if (schedule.speaker_id) {
        req.session.flash = { type: 'error', message: 'This slot is already confirmed.' };
        return res.redirect('/schedules');
      }

      const chosenTopic = topicInput || schedule.topic || null;

      const updateSql = `
        UPDATE schedules
        SET speaker_id = ?, status = 'confirmed',
            topic = ?,
            reminder_24_sent = 0, reminder_6_sent = 0
        WHERE id = ?
      `;

      db.query(updateSql, [user.id, chosenTopic, scheduleId], async err2 => {
        if (err2) {
          console.error(err2);
          req.session.flash = { type: 'error', message: 'Could not confirm this slot.' };
          return res.redirect('/schedules');
        }

        const dateStr = schedule.date instanceof Date
          ? schedule.date.toISOString().split('T')[0]
          : schedule.date;

        const msg = `You have been scheduled for Jumuah on ${dateStr} at ${schedule.time}. Topic: ${chosenTopic || 'TBD'}. - Masjid al-Husna`;
        const adminInfo = `Speaker ${user.name} (phone: ${user.phone || 'N/A'}, email: ${user.email || 'N/A'}) has opted in for Jumuah on ${dateStr} at ${schedule.time}. Topic: ${chosenTopic || 'N/A'}`;

        await notifySpeaker(user, msg, 'Jumuah commitment confirmed');
        await notifyAdmin('Jumuah slot confirmed', adminInfo);

        req.session.flash = { type: 'success', message: 'You are now confirmed for this Jumuah slot.' };
        return res.redirect('/dashboard');
      });
    }
  );
});

// Update topic for a confirmed slot
router.post('/schedules/:id/topic', ensureAuthenticated, (req, res) => {
  const scheduleId = req.params.id;
  const user = req.session.user;
  const topic = (req.body.topic || '').trim().slice(0, 255);

  db.query(
    `SELECT * FROM schedules WHERE id = ? LIMIT 1`,
    [scheduleId],
    (err, results) => {
      const schedule = results && results[0];
      if (err || !schedule) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Schedule not found.' };
        return res.redirect('/dashboard');
      }

      if (!user.is_admin && schedule.speaker_id !== user.id) {
        req.session.flash = { type: 'error', message: 'You cannot edit the topic for this slot.' };
        return res.redirect('/dashboard');
      }

      db.query(
        `UPDATE schedules SET topic = ? WHERE id = ?`,
        [topic || null, scheduleId],
        err2 => {
          if (err2) {
            console.error(err2);
            req.session.flash = { type: 'error', message: 'Could not update the topic.' };
            return res.redirect('/dashboard');
          }

          req.session.flash = { type: 'success', message: 'Topic updated.' };
          return res.redirect('/dashboard');
        }
      );
    }
  );
});

// Cancel
router.post('/schedules/:id/cancel', ensureAuthenticated, (req, res) => {
  const scheduleId = req.params.id;
  const user = req.session.user;

  db.query(
    `SELECT * FROM schedules WHERE id = ? LIMIT 1`,
    [scheduleId],
    (err, results) => {
      const schedule = results && results[0];
      if (err || !schedule) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Schedule not found.' };
        return res.redirect('/dashboard');
      }

      if (!schedule.speaker_id || (schedule.speaker_id !== user.id && !user.is_admin)) {
        req.session.flash = { type: 'error', message: 'You cannot cancel this commitment.' };
        return res.redirect('/dashboard');
      }

      const updateSql = `
        UPDATE schedules
        SET speaker_id = NULL,
            status = 'open',
            reminder_24_sent = 0,
            reminder_6_sent = 0
        WHERE id = ?
      `;

      db.query(updateSql, [scheduleId], async err2 => {
        if (err2) {
          console.error(err2);
          req.session.flash = { type: 'error', message: 'Could not cancel this commitment.' };
          return res.redirect('/dashboard');
        }

        const dateStr = schedule.date instanceof Date
          ? schedule.date.toISOString().split('T')[0]
          : schedule.date;

        const msg = `Your Jumuah commitment on ${dateStr} at ${schedule.time} has been cancelled. - Masjid al-Husna`;
        const adminInfo = `Speaker ${user.name} (phone: ${user.phone || 'N/A'}, email: ${user.email || 'N/A'}) has cancelled their Jumuah commitment on ${dateStr} at ${schedule.time}. Topic: ${schedule.topic || 'N/A'}`;

        await notifySpeaker(user, msg, 'Jumuah commitment cancelled');
        await notifyAdmin('Jumuah commitment cancelled', adminInfo);

        req.session.flash = { type: 'success', message: 'Your commitment has been cancelled.' };
        return res.redirect('/dashboard');
      });
    }
  );
});

module.exports = router;
