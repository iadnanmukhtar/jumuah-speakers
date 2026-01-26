const express = require('express');
const { getUpcomingSchedules, partitionUpcoming } = require('../services/scheduleService');
const { getLastSpeakerUpdateDate } = require('../utils/scheduleStats');

const router = express.Router();

router.get('/public/schedule', (req, res) => {
  getUpcomingSchedules(21)
    .then(({ schedules, range }) => {
      const viewModel = partitionUpcoming(schedules);
      const lastUpdated = getLastSpeakerUpdateDate(schedules);
      if (lastUpdated) {
        res.set('Last-Modified', new Date(lastUpdated).toUTCString());
      }
      res.render('public_schedule', {
        title: 'Masjid al-Husna | Upcoming Jumuahs',
        schedules,
        range,
        lastUpdated,
        ...viewModel
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).render('not_found', { title: 'Schedule unavailable' });
    });
});

module.exports = router;
