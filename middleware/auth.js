function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.flash = { type: 'error', message: 'Please login to continue.' };
  return res.redirect('/login');
}

function ensureAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.is_admin) {
    return next();
  }
  req.session.flash = { type: 'error', message: 'Admin access required.' };
  return res.redirect('/dashboard');
}

module.exports = {
  ensureAuthenticated,
  ensureAdmin
};
