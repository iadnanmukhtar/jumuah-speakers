// @ts-check
const nodemailer = require('nodemailer');
const config = require('./config');
/** @typedef {import('./types').User} User */

// Build a transporter only when SMTP is configured; otherwise we log instead of failing.
let transporter = null;

if (config.mail.smtpHost) {
  transporter = nodemailer.createTransport({
    host: config.mail.smtpHost,
    port: config.mail.smtpPort,
    secure: false,
    auth: {
      user: config.mail.smtpUser,
      pass: config.mail.smtpPass
    }
  });
}

function appendFooter(text) {
  const body = (text || '').trimEnd();
  const footer = `— ${config.app.name}\n${config.app.url}`;

  if (body.includes(config.app.url) || body.includes(config.app.name)) {
    return body;
  }

  return `${body}${body ? '\n\n' : ''}${footer}`;
}

/**
 * Send a plain-text email, logging if SMTP is not configured.
 * @param {string|null|undefined} to
 * @param {string} subject
 * @param {string} text
 * @returns {Promise<void>}
 */
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
    from: config.mail.fromEmail,
    to,
    subject,
    text: finalText
  });
}

/**
 * Send an email to the configured admin address.
 * @param {string} subject
 * @param {string} text
 */
async function notifyAdmin(subject, text) {
  return sendEmail(config.admin.email, subject, text);
}

module.exports = {
  sendEmail,
  notifyAdmin
};
