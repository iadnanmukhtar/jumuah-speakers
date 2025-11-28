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

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@masjid.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@masjid.com';
const APP_NAME = 'Masjid al-Husna | Jumuah Speaker Scheduling';
const APP_URL = 'https://www.masjidalhusna.com/services/jumuah';

function appendFooter(text) {
  const body = (text || '').trimEnd();
  const footer = `— ${APP_NAME}\n${APP_URL}`;

  if (body.includes(APP_URL) || body.includes(APP_NAME)) {
    return body;
  }

  return `${body}${body ? '\n\n' : ''}${footer}`;
}

async function sendEmail(to, subject, text) {
  if (!to) {
    console.log('[Mailer] No "to" address specified, skipping email.');
    return;
  }

  const finalText = appendFooter(text);

  if (!transporter) {
    console.log('[Mailer] SMTP not configured - email log only');
    console.log({ to, subject, text: finalText });
    return;
  }

  await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject,
    text: finalText
  });
}

async function notifyAdmin(subject, text) {
  return sendEmail(ADMIN_EMAIL, subject, text);
}

module.exports = {
  sendEmail,
  notifyAdmin
};
