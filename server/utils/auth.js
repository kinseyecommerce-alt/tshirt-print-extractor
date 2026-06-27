// ============================================================
// Authentication middleware
// ============================================================

/**
 * Express middleware that blocks requests without an authenticated session.
 * The login route sets `req.session.user`.
 */
export function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated. Please log in.' });
}
