const { randomBytes, createHash } = require('node:crypto');
const { hashPassword, verifyPassword } = require('./passwords');
const COOKIE = 'pantrypal_session';
const TTL = 8 * 60 * 60 * 1000;
const digest = (token) => createHash('sha256').update(token).digest('hex');
const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
function tokenFrom(req) {
  const item = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  const token = item ? item.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
function publicUser(row) {
  return { user_id: row.user_id, name: row.name, email: row.email, role: row.role, diet_pref: row.diet_pref };
}
async function newSession(client, userId, previousToken) {
  const token = randomBytes(32).toString('hex');
  if (previousToken) await client.query('DELETE FROM app_session WHERE token_hash=$1', [digest(previousToken)]);
  await client.query('DELETE FROM app_session WHERE expires_at <= now()');
  await client.query('INSERT INTO app_session (token_hash, user_id, expires_at) VALUES ($1,$2,$3)',
    [digest(token), userId, new Date(Date.now() + TTL)]);
  return token;
}
function authRoutes(app, pool, wrap) {
  // Browser mutations must be same-origin JSON. SameSite cookies add another CSRF boundary.
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (!req.is('application/json')) return res.status(415).json({ error: 'Send JSON data.' });
    const origin = req.get('Origin');
    if (req.get('Sec-Fetch-Site') === 'cross-site' ||
        (origin && origin !== `${req.protocol}://${req.get('host')}`)) {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }
    next();
  });
  const attempts = new Map();
  function limit(req, res, next) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = req.ip;
    const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    if (++entry.count > 30) return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    attempts.set(key, entry);
    next();
  }
  app.post('/api/auth/register', limit, wrap(async (req, res) => {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body.password;
    const diet = body.diet_pref || 'any';
    if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120 ||
        typeof password !== 'string' || password.length < 8 || password.length > 128 ||
        !['any','veg','vegan','non-veg'].includes(diet)) {
      return res.status(400).json({ error: 'Enter a name, valid email, diet preference and an 8–128 character password.' });
    }
    const encoded = await hashPassword(password);
    const client = await pool.connect();
    let user, token;
    try {
      await client.query('BEGIN');
      const result = await client.query(`INSERT INTO app_user (name,email,password_hash,role,diet_pref)
        VALUES ($1,$2,$3,'user',$4) RETURNING user_id,name,email,role,diet_pref`, [name,email,encoded,diet]);
      user = result.rows[0];
      await client.query(`INSERT INTO meal_plan (user_id,plan_name,week_start)
        VALUES ($1,'My weekly plan',date_trunc('week',CURRENT_DATE)::date)`, [user.user_id]);
      token = await newSession(client, user.user_id, tokenFrom(req));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') return res.status(409).json({ error: 'This email is already registered.' });
      throw error;
    } finally { client.release(); }
    res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: TTL });
    res.status(201).json({ user: publicUser(user) });
  }));
  app.post('/api/auth/login', limit, wrap(async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || email.length > 120 || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ error: 'Enter your email and password.' });
    }
    const result = await pool.query('SELECT * FROM app_user WHERE lower(email)=$1', [email.trim().toLowerCase()]);
    const user = result.rows[0];
    // Derive a dummy hash too so missing and disabled accounts do comparable password work.
    const encoded = user && user.password_hash.startsWith('scrypt$') ? user.password_hash : await hashPassword('unavailable-account');
    const valid = await verifyPassword(password, encoded);
    if (!user || !valid || !user.password_hash.startsWith('scrypt$')) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const token = await newSession(pool, user.user_id, tokenFrom(req));
    res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: TTL });
    res.json({ user: publicUser(user) });
  }));
  app.post('/api/auth/logout', wrap(async (req, res) => {
    const token = tokenFrom(req);
    if (token) await pool.query('DELETE FROM app_session WHERE token_hash=$1', [digest(token)]);
    res.clearCookie(COOKIE, cookieOptions());
    res.json({ ok: true });
  }));
  // All subsequent API routes require a non-expired database session.
  app.use('/api', wrap(async (req, res, next) => {
    const token = tokenFrom(req);
    if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
    const result = await pool.query(`SELECT u.user_id,u.name,u.email,u.role,u.diet_pref
      FROM app_session s JOIN app_user u USING (user_id)
      WHERE s.token_hash=$1 AND s.expires_at > now()`, [digest(token)]);
    if (!result.rows.length) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    req.user = publicUser(result.rows[0]);
    next();
  }));
  app.get('/api/auth/me', (req, res) => res.json({ user: req.user }));
}
module.exports = { authRoutes };
