const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { ensureAuthenticated } = require('../middleware/auth');
const { blockIfReadOnly } = require('../middleware/readOnly');
const { getUpcomingSchedules, partitionUpcoming } = require('../services/scheduleService');
const { normalizePhone } = require('../utils/phone');

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
      res.render('login', {
        title: 'Masjid al-Husna Jumuah Speaker Scheduler',
        publicSchedules: schedules || [],
        range,
        ...viewModel
      });
    })
    .catch(err => {
      console.error(err);
      res.render('login', {
        title: 'Masjid al-Husna Jumuah Speaker Scheduler',
        publicSchedules: [],
        range: null,
        upcomingSlots: [],
        remaining: []
      });
    });
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

    if (uploadData) {
      const match = uploadData.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
      if (!match) {
        req.session.flash = { type: 'error', message: 'Profile photo must be a PNG or JPG.' };
        return res.redirect('/profile');
      }

      const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
      const base64Data = match[2];
      let buffer;
      try {
        buffer = Buffer.from(base64Data, 'base64');
      } catch (e) {
        console.error('Error decoding avatar data', e);
        req.session.flash = { type: 'error', message: 'Could not process profile photo.' };
        return res.redirect('/profile');
      }

      const maxBytes = 1.5 * 1024 * 1024; // ~1.5MB
      if (!buffer || buffer.length === 0 || buffer.length > maxBytes) {
        req.session.flash = { type: 'error', message: 'Profile photo is too large. Please use a smaller image.' };
        return res.redirect('/profile');
      }

      const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
      try {
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const fileName = `avatar-${userId}-${Date.now()}.${ext}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, buffer);

        // Clean up previous avatar if it lives in /uploads
        if (avatarUrl && avatarUrl.startsWith('/uploads/')) {
          const oldPath = path.join(uploadDir, path.basename(avatarUrl));
          fs.unlink(oldPath, () => {});
        }

        avatarUrl = `/uploads/${fileName}`;
      } catch (e) {
        console.error('Error saving avatar', e);
        req.session.flash = { type: 'error', message: 'Could not save profile photo.' };
        return res.redirect('/profile');
      }
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
