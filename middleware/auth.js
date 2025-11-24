function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    const user = req.session.user;
    const missingEmail = !user.email || String(user.email).trim() === '';
    const isProfileRoute = req.path.startsWith('/profile');
    const isLogout = req.path === '/logout';
    if (missingEmail && !isProfileRoute && !isLogout) {
      req.session.flash = { type: 'error', message: 'Please add your email to continue.' };
      return res.redirect('/profile');
    }
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
