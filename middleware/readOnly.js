const { readOnlyMode } = require('../utils/readOnly');

function blockIfReadOnly(redirectPath) {
  return (req, res, next) => {
    if (!readOnlyMode) return next();

    req.session.flash = {
      type: 'error',
      message: 'Editing is currently disabled. Viewing only mode is active.'
    };

    const target = redirectPath || req.get('referer') || '/';
    return res.redirect(target);
  };
}

module.exports = {
  blockIfReadOnly,
  readOnlyMode
};
