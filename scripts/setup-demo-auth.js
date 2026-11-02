// Local-only demo credential provisioning. No password is committed or hardcoded.
const { randomBytes } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { Pool } = require('pg');
const { hashPassword } = require('../lib/passwords');
(async () => {
  const pool = new Pool({ database: process.env.PGDATABASE || 'pantrypal' });
  const password = process.env.DEMO_PASSWORD || randomBytes(15).toString('base64url');
  if (password.length < 8 || password.length > 128) throw new Error('DEMO_PASSWORD must contain 8–128 characters.');
  try {
    const candidates = await pool.query(`SELECT user_id,email FROM app_user
      WHERE email IN ('admin@pantrypal.com','aarav@example.com','meera@example.com','rohan@example.com')
      AND password_hash NOT LIKE 'scrypt$%' ORDER BY user_id`);
    const result = { rows: [] };
    for (const user of candidates.rows) {
      const encoded = await hashPassword(password); // A separate random salt for each account.
      const updated = await pool.query(`UPDATE app_user SET password_hash=$1
        WHERE user_id=$2 AND password_hash NOT LIKE 'scrypt$%' RETURNING email`, [encoded,user.user_id]);
      result.rows.push(...updated.rows);
    }
    if (!result.rows.length) { console.log('Demo accounts already have passwords; nothing changed.'); return; }
    writeFileSync('DEMO_LOGIN.local.txt',
      'LOCAL DEMO CREDENTIALS — do not upload or share publicly\n\n' +
      result.rows.map(x => x.email).join('\n') + '\n\nPassword: ' + password + '\n', { mode: 0o600 });
    console.log(`Enabled ${result.rows.length} demo accounts. Open DEMO_LOGIN.local.txt locally for their password.`);
  } finally { await pool.end(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
