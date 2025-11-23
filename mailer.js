require('dotenv').config();
const nodemailer = require('nodemailer');

let transporter = null;

if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mashid.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@masjid.com';

async function sendEmail(to, subject, text) {
  if (!to) {
    console.log('[Mailer] No "to" address specified, skipping email.');
    return;
  }

  if (!transporter) {
    console.log('[Mailer] SMTP not configured - email log only');
    console.log({ to, subject, text });
    return;
  }

  await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject,
    text
  });
}

async function notifyAdmin(subject, text) {
  return sendEmail(ADMIN_EMAIL, subject, text);
}

module.exports = {
  sendEmail,
  notifyAdmin
};
