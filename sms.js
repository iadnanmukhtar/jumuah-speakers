// @ts-check
const twilio = require('twilio');
const config = require('./config');

let client = null;
let isSmsConfigured = false;

if (config.sms.accountSid && config.sms.authToken && config.sms.fromNumber) {
  client = twilio(config.sms.accountSid, config.sms.authToken);
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
    from: config.sms.fromNumber,
    to,
    body
  });
}

module.exports = {
  sendSms,
  isSmsConfigured
};
