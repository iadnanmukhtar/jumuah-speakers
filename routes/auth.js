const express = require('express');
const db = require('../db');
const { ensureAuthenticated } = require('../middleware/auth');
const { normalizePhone } = require('../utils/phone');

const router = express.Router();

// Registration
router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register', { title: 'Masjid al-Husna | Jumuah Speaker Registration' });
});

router.post('/register', (req, res) => {
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
  res.render('login', { title: 'Masjid al-Husna Jumuah Speaker Scheduler' });
});

// Speaker login via phone
router.post('/login/speaker', (req, res) => {
  const { phone } = req.body;
  const normalizedPhone = normalizePhone(phone);
  const rawDigits = String(phone || '').replace(/\D/g, '');
  const normalizedDigits = normalizedPhone.replace(/\D/g, '');
  const phoneDigitsNoCountry =
    normalizedDigits.length === 11 && normalizedDigits.startsWith('1')
      ? normalizedDigits.slice(1)
      : normalizedDigits;

  if (!normalizedPhone) {
    req.session.flash = { type: 'error', message: 'Phone is required.' };
    return res.redirect('/login');
  }

  db.query(
    `
      SELECT * FROM users
      WHERE is_admin = 0
        AND (
          phone = ?
          OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?
          OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?
          OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?
        )
      LIMIT 1
    `,
    [normalizedPhone, normalizedDigits, phoneDigitsNoCountry, rawDigits],
    (err, results) => {
      if (err || !results || results.length === 0) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Speaker not found with that phone.' };
        return res.redirect('/login');
      }

      const user = results[0];
      const sessionPhone = normalizePhone(user.phone) || user.phone;

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: sessionPhone,
        bio: user.bio,
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

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        bio: user.bio,
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
    `SELECT id, name, email, phone, bio FROM users WHERE id = ? LIMIT 1`,
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

router.post('/profile', ensureAuthenticated, (req, res) => {
  const userId = req.session.user.id;
  const { name, phone, email, bio } = req.body;
  const normalizedPhone = normalizePhone(phone);
  const trimmedEmail = (email || '').trim();

  if (!name || !normalizedPhone || !trimmedEmail) {
    req.session.flash = { type: 'error', message: 'Name, email, and a valid phone are required.' };
    return res.redirect('/profile');
  }

  const sql = `
    UPDATE users
    SET name = ?, email = ?, phone = ?, bio = ?
    WHERE id = ?
  `;

  db.query(sql, [name, trimmedEmail, normalizedPhone, bio || '', userId], err => {
    if (err) {
      console.error(err);
      if (err.code === 'ER_DUP_ENTRY') {
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
      bio: bio || ''
    };

    req.session.flash = { type: 'success', message: 'Profile updated.' };
    return res.redirect('/profile');
  });
});

module.exports = router;
