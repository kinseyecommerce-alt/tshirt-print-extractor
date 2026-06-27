// ============================================================
// Auth routes: login / logout / me
// ============================================================
import { Router } from 'express';

const router = Router();

/**
 * POST /api/login
 * Validates the username/password against the values stored in the
 * environment (APP_USERNAME / APP_PASSWORD) and creates a session.
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  const expectedUser = process.env.APP_USERNAME || 'jagadeesh';
  const expectedPass = process.env.APP_PASSWORD || '12345';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  if (username === expectedUser && password === expectedPass) {
    req.session.user = { username };
    return res.json({ user: { username } });
  }

  return res.status(401).json({ error: 'Invalid username or password.' });
});

/**
 * POST /api/logout
 * Destroys the current session.
 */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('ape.sid');
    res.json({ ok: true });
  });
});

/**
 * GET /api/me
 * Returns the currently authenticated user (or 401 if not logged in).
 */
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  return res.status(401).json({ error: 'Not authenticated.' });
});

export default router;
