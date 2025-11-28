const express = require('express');
const { getUpcomingSchedules, partitionUpcoming } = require('../services/scheduleService');

const router = express.Router();

router.get('/public/schedule', (req, res) => {
  getUpcomingSchedules(21)
    .then(({ schedules, range }) => {
      const viewModel = partitionUpcoming(schedules);
      res.render('public_schedule', {
        title: 'Masjid al-Husna | Upcoming Jumuahs',
        schedules,
        range,
        ...viewModel
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).render('not_found', { title: 'Schedule unavailable' });
    });
});

module.exports = router;
