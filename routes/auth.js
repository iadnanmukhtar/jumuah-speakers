// @ts-check
const express = require('express');
const db = require('../db');
const { ensureAuthenticated } = require('../middleware/auth');
const { blockIfReadOnly } = require('../middleware/readOnly');
const { getUpcomingSchedules, partitionUpcoming } = require('../services/scheduleService');
const { getLastSpeakerUpdateDate } = require('../utils/scheduleStats');
const { normalizePhone, phoneVariants } = require('../utils/phone');
const { saveAvatar } = require('../utils/avatar');
/** @typedef {import('../types').User} User */

const router = express.Router();

// Registration
router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register', { title: 'Masjid al-Husna | Jumuah Speaker Registration' });
});

router.post('/register', blockIfReadOnly('/register'), (req, res) => {
  const { name, phone, email, bio } = req.body;
  const normalizedPhone = normalizePhone(phone);
  const trimmedEmail = (email || '').trim();

  if (!name || !normalizedPhone || !trimmedEmail) {
    req.session.flash = { type: 'error', message: 'Name, email, and a valid phone are required.' };
    return res.redirect('/register');
  }

  const sql = `
    INSERT INTO users (name, email, phone, bio, password_hash, is_admin)
    VALUES (?, ?, ?, ?, NULL, 0)
  `;

  db.query(sql, [name, trimmedEmail, normalizedPhone, bio || ''], (err, result) => {
    if (err) {
      console.error(err);
      req.session.flash = {
        type: 'error',
        message: 'Phone or email may already be registered, or a database error occurred.'
      };
      return res.redirect('/register');
    }

    req.session.user = {
      id: result.insertId,
      name,
      email: trimmedEmail,
      phone: normalizedPhone,
      bio: bio || '',
      avatar_url: null,
      is_admin: 0,
      is_super_admin: 0
    };

    req.session.flash = { type: 'success', message: 'Registration successful. Welcome.' };
    return res.redirect('/dashboard');
  });
});

// Login
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');

  getUpcomingSchedules(21, 12)
    .then(({ schedules, range }) => {
      const viewModel = partitionUpcoming(schedules);
      const lastUpdated = getLastSpeakerUpdateDate(schedules);
      if (lastUpdated) {
        res.set('Last-Modified', new Date(lastUpdated).toUTCString());
      }
      res.render('login', {
        title: 'Masjid al-Husna Jumuah Speaker Scheduler',
        publicSchedules: schedules || [],
        range,
        lastUpdated,
        ...viewModel
      });
    })
    .catch(err => {
      console.error(err);
      res.render('login', {
        title: 'Masjid al-Husna Jumuah Speaker Scheduler',
        publicSchedules: [],
        range: null,
        lastUpdated: null,
        upcomingSlots: [],
        remaining: []
      });
    });
});

// Speaker login via phone
router.post('/login/speaker', (req, res) => {
  const { phone } = req.body;
  const normalizedPhone = normalizePhone(phone);
  // Build a few normalized digit variants to tolerate formatting differences.
  const digitVariants = phoneVariants(phone);

  if (!normalizedPhone) {
    req.session.flash = { type: 'error', message: 'Phone is required.' };
    return res.redirect('/login');
  }

  if (!digitVariants.length) {
    req.session.flash = { type: 'error', message: 'Please enter a valid phone number.' };
    return res.redirect('/login');
  }

  const placeholders = digitVariants.map(() => '?').join(', ');

  db.query(
    `
      SELECT *
      FROM users
      WHERE (is_admin IS NULL OR is_admin = 0)
        AND (
          phone = ?
          OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') IN (${placeholders})
        )
      LIMIT 1
    `,
    [normalizedPhone, ...digitVariants],
    (err, results) => {
      if (err || !results || results.length === 0) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Speaker not found with that phone.' };
        return res.redirect('/login');
      }

      const user = results[0];
      const sessionPhone = normalizePhone(user.phone) || user.phone;

      /** @type {User} */
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: sessionPhone,
        bio: user.bio,
        avatar_url: user.avatar_url || null,
        is_admin: !!user.is_admin,
        is_super_admin: !!user.is_admin
      };

      if (!user.email) {
        req.session.flash = { type: 'error', message: 'Please add your email to continue.' };
        return res.redirect('/profile');
      }

      req.session.flash = { type: 'success', message: 'Logged in as speaker.' };
      return res.redirect('/dashboard');
    }
  );
});

// Admin login via email + password
router.post('/login/admin', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.session.flash = { type: 'error', message: 'Email and password are required.' };
    return res.redirect('/login');
  }

  db.query(
    `SELECT * FROM users WHERE email = ? AND is_admin = 1 LIMIT 1`,
    [email],
    (err, results) => {
      if (err || !results || results.length === 0) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Invalid admin credentials.' };
        return res.redirect('/login');
      }

      const user = results[0];
      const match = password === (user.password_hash || '');

      if (!match) {
        req.session.flash = { type: 'error', message: 'Invalid admin credentials.' };
        return res.redirect('/login');
      }

      /** @type {User} */
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        bio: user.bio,
        avatar_url: user.avatar_url || null,
        is_admin: !!user.is_admin,
        is_super_admin: !!user.is_admin
      };

      req.session.flash = { type: 'success', message: 'Admin login successful.' };
      return res.redirect('/dashboard');
    }
  );
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Profile
router.get('/profile', ensureAuthenticated, (req, res) => {
  const userId = req.session.user.id;

  db.query(
    `SELECT id, name, email, phone, bio, avatar_url FROM users WHERE id = ? LIMIT 1`,
    [userId],
    (err, results) => {
      if (err || !results || results.length === 0) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Could not load your profile.' };
        return res.redirect('/dashboard');
      }

      res.render('profile', {
        title: 'Masjid al-Husna | My Profile',
        user: results[0],
        requireEmail: !results[0].email
      });
    }
  );
});

router.post('/profile', ensureAuthenticated, blockIfReadOnly('/profile'), (req, res) => {
  const userId = req.session.user.id;
  const { name, phone, email, bio, avatar_data } = req.body;
  const normalizedPhone = normalizePhone(phone);
  const trimmedEmail = (email || '').trim();

  if (!name || !normalizedPhone || !trimmedEmail) {
    req.session.flash = { type: 'error', message: 'Name, email, and a valid phone are required.' };
    return res.redirect('/profile');
  }

  db.query(`SELECT avatar_url FROM users WHERE id = ? LIMIT 1`, [userId], (err, results) => {
    const existingAvatar = results && results[0] ? results[0].avatar_url : null;
    if (err || !results || results.length === 0) {
      console.error(err);
      req.session.flash = { type: 'error', message: 'Could not update profile.' };
      return res.redirect('/profile');
    }

    let avatarUrl = existingAvatar || req.session.user.avatar_url || null;
    const uploadData = (avatar_data || '').trim();

    try {
      avatarUrl = saveAvatar(userId, uploadData, avatarUrl);
    } catch (e) {
      req.session.flash = { type: 'error', message: e.message || 'Could not save profile photo.' };
      return res.redirect('/profile');
    }

    const sql = `
      UPDATE users
      SET name = ?, email = ?, phone = ?, bio = ?, avatar_url = ?
      WHERE id = ?
    `;

    db.query(sql, [name, trimmedEmail, normalizedPhone, bio || '', avatarUrl, userId], err2 => {
      if (err2) {
        console.error(err2);
        if (err2.code === 'ER_DUP_ENTRY') {
          req.session.flash = { type: 'error', message: 'That phone or email is already in use.' };
        } else {
          req.session.flash = { type: 'error', message: 'Could not update profile.' };
        }
        return res.redirect('/profile');
      }

      req.session.user = {
        ...req.session.user,
        name,
        email: trimmedEmail,
        phone: normalizedPhone,
        bio: bio || '',
        avatar_url: avatarUrl
      };

      req.session.flash = { type: 'success', message: 'Profile updated.' };
      return res.redirect('/profile');
    });
  });
});

module.exports = router;
