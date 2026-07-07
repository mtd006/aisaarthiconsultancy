function requireLogin(req, res, next) {
  if (!req.session.user) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ success: false, message: 'Not logged in' });
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    if (req.path.startsWith('/api/')) return res.status(403).json({ success: false, message: 'Admin access required' });
    return res.redirect('/login');
  }
  next();
}

function requireClient(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'client') {
    if (req.path.startsWith('/api/')) return res.status(403).json({ success: false, message: 'Client access required' });
    return res.redirect('/login');
  }
  next();
}

module.exports = { requireLogin, requireAdmin, requireClient };
