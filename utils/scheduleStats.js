function getLastSpeakerUpdateDate(schedules = []) {
  if (!Array.isArray(schedules)) return null;

  return schedules.reduce((latest, schedule) => {
    const hasSpeaker = schedule && (schedule.speaker_id || schedule.speaker_name);
    if (!hasSpeaker) return latest;

    const date = schedule.date instanceof Date ? schedule.date : new Date(schedule.date);
    if (Number.isNaN(date.getTime())) return latest;

    if (!latest) return date;
    return date > latest ? date : latest;
  }, null);
}

module.exports = {
  getLastSpeakerUpdateDate
};
