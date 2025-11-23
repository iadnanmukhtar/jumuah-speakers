const twilio = require('twilio');
require('dotenv').config();

let client = null;
let isSmsConfigured = false;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  isSmsConfigured = true;
}

async function sendSms(to, body) {
  if (!to) {
    console.log('[SMS] No destination phone provided, skipping.');
    return;
  }

  if (!client) {
    console.log('[SMS] Twilio not configured - SMS log only');
    console.log({ to, body });
    return;
  }

  await client.messages.create({
    from: process.env.TWILIO_FROM_NUMBER,
    to,
    body
  });
}

module.exports = {
  sendSms,
  isSmsConfigured
};
