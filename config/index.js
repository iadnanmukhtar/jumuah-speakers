const path = require('path');

require('dotenv').config();

// Typed helpers for environment parsing keep the config object predictable.
function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function parseIntSafe(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseIntSafe(process.env.PORT, 3000),
  session: {
    secret: process.env.SESSION_SECRET || 'very-secret-key',
    maxAgeMs: 1000 * 60 * 60 * 24 * 7
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'jumuah_app',
    multipleStatements: true
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@masjid.com',
    phone: process.env.ADMIN_PHONE || '+10000000000',
    password: process.env.ADMIN_PASS || 'admin123'
  },
  mail: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseIntSafe(process.env.SMTP_PORT, 587),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    fromEmail: process.env.FROM_EMAIL || 'no-reply@masjid.com'
  },
  sms: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER
  },
  flags: {
    readOnly: parseBool(process.env.DISABLE_EDITING)
  },
  paths: {
    uploads: uploadsDir
  },
  app: {
    name: 'Masjid al-Husna | Jumuah Speaker Scheduling',
    url: 'https://www.masjidalhusna.com/services/jumuah'
  }
};
