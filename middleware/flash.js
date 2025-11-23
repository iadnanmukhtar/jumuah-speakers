function flashMiddleware(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.adminView = req.session.adminView || false;

  res.locals.flash = req.session.flash || null;
  delete req.session.flash;

  next();
}

module.exports = flashMiddleware;
