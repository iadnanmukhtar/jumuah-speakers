const helpers = require('../utils/viewHelpers');

function viewLocals(req, res, next) {
  res.locals.helpers = helpers;
  next();
}

module.exports = viewLocals;
// @ts-check
