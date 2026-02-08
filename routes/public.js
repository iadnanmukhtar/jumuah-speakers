// @ts-check
const express = require('express');
const { getUpcomingSchedules, getWeeklySchedules, partitionUpcoming, getWeekRange } = require('../services/scheduleService');
const { getLastSpeakerUpdateDate } = require('../utils/scheduleStats');

const router = express.Router();

router.get('/public/schedule', (req, res) => {
  const weekOffset = parseInt(req.query.weekOffset || '0', 10) || 0;

  getWeeklySchedules(weekOffset)
    .then(({ schedules, range }) => {
      const viewModel = partitionUpcoming(schedules);
      const lastUpdated = getLastSpeakerUpdateDate(schedules);
      if (lastUpdated) {
        res.set('Last-Modified', new Date(lastUpdated).toUTCString());
      }

      const basePath = '/public/schedule';
      const prevOffset = weekOffset - 1;
      const nextOffset = weekOffset + 1;

      res.render('public_schedule', {
        title: 'Masjid al-Husna | Upcoming Events',
        schedules,
        range,
        lastUpdated,
        weekOffset,
        prevLink: `${basePath}?weekOffset=${prevOffset}`,
        nextLink: `${basePath}?weekOffset=${nextOffset}`,
        ...viewModel
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).render('not_found', { title: 'Schedule unavailable' });
    });
});

module.exports = router;
