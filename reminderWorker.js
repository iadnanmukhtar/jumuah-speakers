require('dotenv').config();

const cron = require('node-cron');
const db = require('./db');
const { notifySpeaker, notifyAdmin } = require('./notify');
const { getUpcomingSchedules } = require('./services/scheduleService');
const { formatDateLong, formatTime } = require('./utils/viewHelpers');

function startReminderWorker() {
  const HOUR = 60 * 60 * 1000;

  cron.schedule('*/10 * * * *', () => {
    const now = new Date();

    db.query(
      `
      SELECT s.*, u.name, u.phone, u.email
      FROM schedules s
      JOIN users u ON s.speaker_id = u.id
      WHERE s.status = 'confirmed'
        AND s.speaker_id IS NOT NULL
        AND s.date >= CURDATE()
      `,
      [],
      async (err, results) => {
        if (err) {
          console.error('[Reminders] Error querying schedules', err);
          return;
        }

        for (const s of results || []) {
          try {
            const eventDate = s.date instanceof Date ? new Date(s.date.getTime()) : new Date(s.date);
            const [hStr, mStr] = String(s.time).split(':');
            const h = parseInt(hStr || '0', 10);
            const m = parseInt(mStr || '0', 10);
            eventDate.setHours(h, m, 0, 0);

            const diffMs = eventDate.getTime() - now.getTime();

            // 24-hour reminder: between 23h and 24h before
            if (!s.reminder_24_sent && diffMs <= 24 * HOUR && diffMs > 23 * HOUR) {
              const dateStr = eventDate.toISOString().split('T')[0];
              const msg = `Reminder: You are scheduled for Jumuah tomorrow (${dateStr}) at ${s.time}. Topic: ${s.topic || 'TBD'}.`;
              await notifySpeaker(s, msg, '24-hour Jumuah reminder');

              db.query(
                `UPDATE schedules SET reminder_24_sent = 1 WHERE id = ?`,
                [s.id],
                err2 => {
                  if (err2) console.error('[Reminders] Error updating 24h flag', err2);
                }
              );
            }

            // 6-hour reminder: between 5h and 6h before
            if (!s.reminder_6_sent && diffMs <= 6 * HOUR && diffMs > 5 * HOUR) {
              const dateStr = eventDate.toISOString().split('T')[0];
              const msg = `Reminder: You are scheduled for Jumuah today (${dateStr}) at ${s.time}. Please arrive early.`;
              await notifySpeaker(s, msg, '6-hour Jumuah reminder');

              db.query(
                `UPDATE schedules SET reminder_6_sent = 1 WHERE id = ?`,
                [s.id],
                err2 => {
                  if (err2) console.error('[Reminders] Error updating 6h flag', err2);
                }
              );
            }
          } catch (e) {
            console.error('[Reminders] Error processing schedule for reminders', e);
          }
        }
      }
    );
  });

  cron.schedule('0 8 * * 1,3,5', async () => {
    try {
      const { schedules } = await getUpcomingSchedules(21);
      if (!schedules || schedules.length === 0) {
        await notifyAdmin('Jumuah coverage: next 3 Fridays', 'No Jumuah slots found in the next 3 weeks.');
        return;
      }

      const grouped = [];
      for (const s of schedules) {
        const dateKey = s.date instanceof Date ? s.date.toISOString().split('T')[0] : String(s.date);
        let bucket = grouped.find(g => g.dateKey === dateKey);
        if (!bucket) {
          bucket = { dateKey, items: [] };
          grouped.push(bucket);
        }
        bucket.items.push(s);
      }

      const firstThree = grouped.slice(0, 3);
      const lines = [];
      lines.push('Upcoming Jumuah coverage (next 3 Fridays):');
      for (const g of firstThree) {
        const readableDate = formatDateLong(g.items[0].date);
        lines.push(`- ${readableDate}:`);
        const sorted = g.items.sort((a, b) => (a.time && b.time ? a.time.localeCompare(b.time) : 0));
        sorted.forEach(item => {
          const speaker = item.speaker_name || 'OPEN';
          const topic = item.topic || 'TBD';
          lines.push(`  • ${formatTime(item.time)} — ${speaker} (Topic: ${topic})`);
        });
      }

      await notifyAdmin('Jumuah coverage: next 3 Fridays', lines.join('\n'));
    } catch (err) {
      console.error('[Reminders] Error sending admin summary', err);
    }
  });

  console.log('[Reminders] Reminder worker scheduled (every 10 minutes).');
}

module.exports = {
  startReminderWorker
};
