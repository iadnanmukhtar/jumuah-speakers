// @ts-check

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} name
 * @property {string|null} email
 * @property {string} phone
 * @property {string|null} bio
 * @property {string|null|undefined} avatar_url
 * @property {boolean|number} [is_admin]
 * @property {boolean|number} [is_super_admin]
 */

/**
 * @typedef {Object} Schedule
 * @property {number} id
 * @property {Date|string} date
 * @property {string} time
 * @property {string|null} topic
 * @property {string|null} notes
 * @property {string} status
 * @property {number|null} [speaker_id]
 * @property {number} reminder_24_sent
 * @property {number} reminder_6_sent
 * @property {Date|string} [created_at]
 */

module.exports = {};
