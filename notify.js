const { sendSms, isSmsConfigured } = require('./sms');
const { sendEmail, notifyAdmin } = require('./mailer');

async function notifySpeaker(user, message, subject = 'Jumuah notification') {
  try {
    if (isSmsConfigured && user.phone) {
      await sendSms(user.phone, message);
      return;
    }

    if (user.email) {
      await sendEmail(user.email, subject, message);
      return;
    }

    console.log('[Notify] No SMS or email available for speaker', {
      id: user.id,
      name: user.name
    });
  } catch (err) {
    console.error('[Notify] Error notifying speaker', err);
  }
}

module.exports = {
  notifySpeaker,
  notifyAdmin
};
