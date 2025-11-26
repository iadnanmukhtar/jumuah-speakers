const express = require('express');
const db = require('../db');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const { ensureUpcomingJumuahs } = require('./helpers');
const { normalizePhone } = require('../utils/phone');
const { notifySpeaker } = require('../notify');

const router = express.Router();

router.post('/admin/toggle-view', ensureAuthenticated, ensureAdmin, (req, res) => {
  req.session.adminView = !req.session.adminView;
  res.redirect('/dashboard');
});

router.get('/admin/schedules', ensureAuthenticated, ensureAdmin, (req, res) => {
  ensureUpcomingJumuahs(err => {
    if (err) {
      console.error(err);
      req.session.flash = { type: 'error', message: 'Error generating schedules.' };
    }

    const schedulesSql = `
      SELECT s.*, u.name AS speaker_name, u.phone AS speaker_phone
      FROM schedules s
      LEFT JOIN users u ON s.speaker_id = u.id
      ORDER BY s.date ASC, s.time ASC
    `;

    const speakersSql = `
      SELECT id, name, phone
      FROM users
      WHERE is_admin = 0
      ORDER BY name ASC
    `;

    db.query(schedulesSql, [], (err2, schedules) => {
      if (err2) {
        console.error(err2);
        req.session.flash = { type: 'error', message: 'Error loading schedules.' };
        return res.redirect('/dashboard');
      }

      db.query(speakersSql, [], (err3, speakers) => {
        if (err3) {
          console.error(err3);
          req.session.flash = { type: 'error', message: 'Error loading speakers.' };
          return res.redirect('/dashboard');
        }

        res.render('admin_schedules', {
          title: 'Masjid al-Husna | Jumuah Schedules',
          schedules: schedules || [],
          speakers: speakers || []
        });
      });
    });
  });
});

router.post('/admin/schedules', ensureAuthenticated, ensureAdmin, (req, res) => {
  const { date, time, topic, notes } = req.body;

  if (!date || !time) {
    req.session.flash = { type: 'error', message: 'Date and time are required.' };
    return res.redirect('/admin/schedules');
  }

  const sql = `
    INSERT INTO schedules (date, time, topic, notes, status)
    VALUES (?, ?, ?, ?, 'open')
  `;

  db.query(sql, [date, time, topic || '', notes || ''], err => {
    if (err) {
      console.error(err);
      req.session.flash = { type: 'error', message: 'Could not create schedule.' };
      return res.redirect('/admin/schedules');
    }

    req.session.flash = { type: 'success', message: 'New Jumuah schedule created.' };
    return res.redirect('/admin/schedules');
  });
});

router.get('/admin/schedules/:id/edit', ensureAuthenticated, ensureAdmin, (req, res) => {
  const id = req.params.id;

  db.query(
    `
    SELECT s.*, u.name AS speaker_name, u.phone AS speaker_phone
    FROM schedules s
    LEFT JOIN users u ON s.speaker_id = u.id
    WHERE s.id = ?
    LIMIT 1
  `,
    [id],
    (err, results) => {
      const schedule = results && results[0];
      if (err || !schedule) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Schedule not found.' };
        return res.redirect('/admin/schedules');
      }

      db.query(
        `SELECT id, name, phone FROM users WHERE is_admin = 0 ORDER BY name ASC`,
        [],
        (err2, speakers) => {
          if (err2) {
            console.error(err2);
            req.session.flash = { type: 'error', message: 'Error loading speakers.' };
            return res.redirect('/admin/schedules');
          }

          res.render('admin_edit_schedule', {
            title: 'Masjid al-Husna | Edit Jumuah Schedule',
            schedule,
            speakers: speakers || []
          });
        }
      );
    }
  );
});

router.post('/admin/schedules/:id/edit', ensureAuthenticated, ensureAdmin, (req, res) => {
  const id = req.params.id;
  const { date, time, topic, notes, status, speaker_id } = req.body;

  const finalSpeakerId = speaker_id && speaker_id !== '' ? speaker_id : null;
  const finalStatus = status || (finalSpeakerId ? 'confirmed' : 'open');

  const sql = `
    UPDATE schedules
    SET date = ?, time = ?, topic = ?, notes = ?, status = ?, speaker_id = ?,
        reminder_24_sent = 0, reminder_6_sent = 0
    WHERE id = ?
  `;

  db.query(
    sql,
    [date, time, topic || '', notes || '', finalStatus, finalSpeakerId, id],
    err => {
      if (err) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Could not update schedule.' };
        return res.redirect('/admin/schedules');
      }

      req.session.flash = { type: 'success', message: 'Schedule updated.' };
      return res.redirect('/admin/schedules');
    }
  );
});

router.post('/admin/schedules/:id/delete', ensureAuthenticated, ensureAdmin, (req, res) => {
  const id = req.params.id;

  db.query(`DELETE FROM schedules WHERE id = ?`, [id], err => {
    if (err) {
      console.error(err);
      req.session.flash = { type: 'error', message: 'Could not delete schedule.' };
      return res.redirect('/admin/schedules');
    }

    req.session.flash = { type: 'success', message: 'Schedule deleted.' };
    return res.redirect('/admin/schedules');
  });
});

router.post('/admin/schedules/:id/assign', ensureAuthenticated, ensureAdmin, (req, res) => {
  const id = req.params.id;
  const { speaker_id } = req.body;
  const status = speaker_id ? 'confirmed' : 'open';

  const sql = `
    UPDATE schedules
    SET speaker_id = ?, status = ?, reminder_24_sent = 0, reminder_6_sent = 0
    WHERE id = ?
  `;

  db.query(sql, [speaker_id || null, status, id], err => {
    if (err) {
      console.error(err);
      req.session.flash = { type: 'error', message: 'Could not assign speaker.' };
      return res.redirect('/admin/schedules');
    }

    req.session.flash = { type: 'success', message: 'Speaker assignment updated.' };
    return res.redirect('/admin/schedules');
  });
});

router.get('/admin/speakers', ensureAuthenticated, ensureAdmin, (req, res) => {
  db.query(
    `SELECT id, name, email, phone, bio
     FROM users
     WHERE is_admin = 0
     ORDER BY name ASC`,
    [],
    (err, speakers) => {
      if (err) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Error loading speakers.' };
        return res.redirect('/dashboard');
      }

      res.render('admin_speakers', {
        title: 'Masjid al-Husna | Speakers',
        speakers: speakers || []
      });
    }
  );
});

router.post('/admin/speakers', ensureAuthenticated, ensureAdmin, (req, res) => {
  const { name, phone, email, bio } = req.body;
  const normalizedPhone = normalizePhone(phone);
  const trimmedEmail = (email || '').trim();

  if (!name || !normalizedPhone) {
    req.session.flash = { type: 'error', message: 'Name and a valid phone are required.' };
    return res.redirect('/admin/speakers');
  }

  const sql = `
    INSERT INTO users (name, email, phone, bio, password_hash, is_admin)
    VALUES (?, ?, ?, ?, NULL, 0)
  `;

  db.query(sql, [name, trimmedEmail || null, normalizedPhone, bio || ''], err => {
    if (err) {
      console.error(err);
      if (err.code === 'ER_DUP_ENTRY') {
        req.session.flash = { type: 'error', message: 'That phone or email is already in use.' };
      } else {
        req.session.flash = { type: 'error', message: 'Could not add speaker.' };
      }
      return res.redirect('/admin/speakers');
    }

    req.session.flash = { type: 'success', message: 'Speaker added.' };
    return res.redirect('/admin/speakers');
  });
});

router.get('/admin/speakers/:id/edit', ensureAuthenticated, ensureAdmin, (req, res) => {
  const id = req.params.id;

  db.query(
    `SELECT id, name, email, phone, bio FROM users WHERE id = ? AND is_admin = 0 LIMIT 1`,
    [id],
    (err, results) => {
      const speaker = results && results[0];
      if (err || !speaker) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Speaker not found.' };
        return res.redirect('/admin/speakers');
      }

      res.render('admin_edit_speaker', {
        title: 'Masjid al-Husna | Edit Speaker',
        speaker
      });
    }
  );
});

router.post('/admin/speakers/:id/edit', ensureAuthenticated, ensureAdmin, (req, res) => {
  const id = req.params.id;
  const { name, phone, email, bio } = req.body;
  const normalizedPhone = normalizePhone(phone);
  const trimmedEmail = (email || '').trim();

  if (!name || !normalizedPhone) {
    req.session.flash = { type: 'error', message: 'Name and a valid phone are required.' };
    return res.redirect(`/admin/speakers/${id}/edit`);
  }

  db.query(
    `SELECT id, name, email, phone FROM users WHERE id = ? AND is_admin = 0 LIMIT 1`,
    [id],
    (err, results) => {
      const existing = results && results[0];
      if (err || !existing) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Speaker not found.' };
        return res.redirect('/admin/speakers');
      }

      db.query(
        `UPDATE users
         SET name = ?, email = ?, phone = ?, bio = ?
         WHERE id = ? AND is_admin = 0`,
        [name, trimmedEmail || null, normalizedPhone, bio || '', id],
        async err2 => {
          if (err2) {
            console.error(err2);
            if (err2.code === 'ER_DUP_ENTRY') {
              req.session.flash = { type: 'error', message: 'That phone or email is already in use.' };
            } else {
              req.session.flash = { type: 'error', message: 'Could not update speaker.' };
            }
            return res.redirect(`/admin/speakers/${id}/edit`);
          }

          req.session.flash = { type: 'success', message: 'Speaker updated.' };

          const updatedUser = {
            id,
            name,
            email: trimmedEmail || null,
            phone: normalizedPhone
          };
          const message = `Your profile was updated by an administrator. If you did not expect this change, please reply to confirm your details.\n\nName: ${name}\nPhone: ${normalizedPhone}\nEmail: ${trimmedEmail || 'N/A'}`;
          await notifySpeaker(updatedUser, message, 'Profile updated');

          return res.redirect('/admin/speakers');
        }
      );
    }
  );
});

router.post('/admin/speakers/:id/delete', ensureAuthenticated, ensureAdmin, (req, res) => {
  const id = req.params.id;

  db.query(`SELECT id, name, email, phone, is_admin FROM users WHERE id = ? LIMIT 1`, [id], (err, results) => {
    const speaker = results && results[0];
    if (err || !speaker || speaker.is_admin) {
      console.error(err);
      req.session.flash = { type: 'error', message: 'Speaker not found or cannot be deleted.' };
      return res.redirect('/admin/speakers');
    }

    const clearSchedulesSql = `
      UPDATE schedules
      SET speaker_id = NULL, status = 'open', reminder_24_sent = 0, reminder_6_sent = 0
      WHERE speaker_id = ?
    `;

    db.query(clearSchedulesSql, [id], err2 => {
      if (err2) {
        console.error(err2);
        req.session.flash = { type: 'error', message: 'Could not clear speaker from schedules.' };
        return res.redirect('/admin/speakers');
      }

      db.query(`DELETE FROM users WHERE id = ? AND is_admin = 0`, [id], err3 => {
        if (err3) {
          console.error(err3);
          req.session.flash = { type: 'error', message: 'Could not delete speaker.' };
          return res.redirect('/admin/speakers');
        }

        const notifyUser = {
          id: speaker.id,
          name: speaker.name,
          email: speaker.email,
          phone: speaker.phone
        };
        const message = `Your speaker profile has been removed by an administrator. Please contact the masjid if you have questions.`;
        notifySpeaker(notifyUser, message, 'Profile deleted');

        req.session.flash = { type: 'success', message: 'Speaker deleted.' };
        return res.redirect('/admin/speakers');
      });
    });
  });
});

module.exports = router;
