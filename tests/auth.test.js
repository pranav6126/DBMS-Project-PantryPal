const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { readFileSync } = require('node:fs');
const { hashPassword, verifyPassword } = require('../lib/passwords');
const database = `pantrypal_test_${process.pid}`;
const admin = new Pool({ database: process.env.PGTEST_ADMIN_DATABASE || 'postgres' });
let service, pool, server, base, first, second, cookie, otherCookie;
const password = 'Test-only-password!34';
async function request(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  return { response, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
before(async () => {
  // All integration fixtures live in a fresh throwaway DB, never the real pantry DB.
  await admin.query(`CREATE DATABASE "${database}"`);
  process.env.PGDATABASE = database;
  process.env.MONGO_DATABASE = database;
  service = require('../server'); pool = service.pool;
  await pool.query(readFileSync('pantrypal_code/schema.sql', 'utf8'));
  await pool.query(readFileSync('pantrypal_code/seed.sql', 'utf8'));
  // The additive migration must also be repeatable on an already-current schema.
  await pool.query(readFileSync('pantrypal_code/migrations/001_auth.sql', 'utf8'));
  server = service.app.listen(0); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (service) await service.closeDatabases();
  const { MongoClient } = require("mongodb");
  const mongo = new MongoClient(process.env.MONGO_URL || "mongodb://127.0.0.1:27017", { serverSelectionTimeoutMS: 1200 });
  try { await mongo.connect(); await mongo.db(database).dropDatabase(); } catch {} finally { await mongo.close(); }
  await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await admin.end();
});
test('ER model matches all nine SQL tables, columns, nullability and foreign keys', async () => {
  const {entities,links}=JSON.parse(readFileSync('docs/schema-model.json','utf8'));
  assert.equal(Object.keys(entities).length,9);
  for (const [name,fields] of Object.entries(entities)) {
    const actual=await pool.query(`SELECT column_name,is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,[name]);
    assert.deepEqual(actual.rows.map(x=>x.column_name),fields.map(x=>x[0]),name);
  }
  const keys=await pool.query(`SELECT child.relname AS child,parent.relname AS parent,a.attname AS field
    FROM pg_constraint c JOIN pg_class child ON c.conrelid=child.oid
    JOIN pg_class parent ON c.confrelid=parent.oid
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    JOIN pg_namespace n ON child.relnamespace=n.oid WHERE c.contype='f' AND n.nspname='public'`);
  const expected=links.map(([parent,child,,field])=>`${child}.${field}->${parent}`).sort();
  assert.deepEqual(keys.rows.map(x=>`${x.child}.${x.field}->${x.parent}`).sort(),expected);
  assert.equal((await pool.query(`SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='recipe' AND column_name='created_by'`)).rows[0].is_nullable,'YES');
});
test('passwords use random salts; wrong and legacy plaintext values fail', async () => {
  const one = await hashPassword(password), two = await hashPassword(password);
  assert.notEqual(one,two); assert.ok(await verifyPassword(password,one));
  assert.equal(await verifyPassword('wrong',one),false);
  assert.equal(await verifyPassword(password,'hash_aarav'),false);
});
test('anonymous API access is blocked, including legacy user-ID endpoints', async () => {
  for (const path of ['/api/pantry','/api/rank','/api/reports','/api/mongo','/api/users','/api/pantry/2']) {
    assert.equal((await request(path)).response.status,401);
  }
});
test('register creates a regular user, default plan, hashed password and protected cookie', async () => {
  const result = await request('/api/auth/register',{ method:'POST',body:{ name:'First User',email:'First@example.com',password,diet_pref:'veg',role:'admin' } });
  assert.equal(result.response.status,201);cookie = result.cookie;first = result.data.user;
  assert.equal(first.role,'user');assert.equal(first.email,'first@example.com');assert.equal(first.password_hash,undefined);
  assert.match(result.response.headers.get('set-cookie'),/HttpOnly/);assert.match(result.response.headers.get('set-cookie'),/SameSite=Strict/);
  const stored = await pool.query('SELECT password_hash FROM app_user WHERE user_id=$1',[first.user_id]);
  assert.ok(stored.rows[0].password_hash.startsWith('scrypt$'));assert.equal(stored.rows[0].password_hash.includes(password),false);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM meal_plan WHERE user_id=$1',[first.user_id])).rows[0].n,1);
  const other = await request('/api/auth/register',{method:'POST',body:{name:'Second User',email:'second@example.com',password,diet_pref:'any'}});
  assert.equal(other.response.status,201);second=other.data.user;otherCookie=other.cookie;
});
test('duplicate case-insensitive emails and invalid registration are rejected', async () => {
  assert.equal((await request('/api/auth/register',{method:'POST',body:{name:'Duplicate',email:'FIRST@example.com',password}})).response.status,409);
  assert.equal((await request('/api/auth/register',{method:'POST',body:{name:'Short',email:'short@example.com',password:'123'}})).response.status,400);
});
test('login rejects wrong passwords, normalizes email and rotates prior sessions', async () => {
  assert.equal((await request('/api/auth/login',{method:'POST',body:{email:first.email,password:'wrong'}})).response.status,401);
  const previous=cookie;
  const logged = await request('/api/auth/login',{method:'POST',headers:{Cookie:cookie},body:{email:'FIRST@EXAMPLE.COM',password}});
  assert.equal(logged.response.status,200);cookie=logged.cookie;assert.notEqual(cookie,previous);
  assert.equal((await request('/api/auth/me',{headers:{Cookie:previous}})).response.status,401);
  assert.equal((await request('/api/auth/me',{headers:{Cookie:cookie}})).data.user.user_id,first.user_id);
});
test('same-origin JSON checks reject cross-origin writes', async () => {
  assert.equal((await request('/api/auth/login',{method:'POST',headers:{Origin:'https://other.example'},body:{email:first.email,password}})).response.status,403);
  const r=await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,'Content-Type':'text/plain'},body:'{}'});
  assert.equal(r.status,415);
});
test('pantry, ranking and missing ingredients belong to the session user', async () => {
  const date=new Date().toISOString().slice(0,10);
  const saved=await request('/api/pantry',{method:'POST',headers:{Cookie:cookie},body:{ingredient_id:1,purchased_on:date,quantity:'200 g',user_id:second.user_id}});
  assert.equal(saved.response.status,200);
  assert.equal((await request('/api/pantry',{headers:{Cookie:cookie}})).data.length,1);
  assert.equal((await request('/api/pantry',{headers:{Cookie:otherCookie}})).data.length,0);
  assert.equal((await request(`/api/pantry/${second.user_id}`,{headers:{Cookie:cookie}})).response.status,404);
  assert.ok((await request('/api/rank',{headers:{Cookie:cookie}})).data.recipes.length>0);
  await pool.query('UPDATE pantry_item SET purchased_on=CURRENT_DATE-100 WHERE user_id=$1',[first.user_id]);
  const missing=await request('/api/missing/1',{headers:{Cookie:cookie}});
  assert.ok(missing.data.some(x=>x.ingredient==='Paneer'));
});
test('planning ignores a spoofed user ID; trigger increments; invalid recipe is rolled back', async () => {
  const before=(await pool.query('SELECT times_cooked FROM recipe WHERE recipe_id=1')).rows[0].times_cooked;
  const result=await request('/api/plan',{method:'POST',headers:{Cookie:cookie},body:{recipe_id:1,user_id:second.user_id}});
  assert.equal(result.response.status,200);assert.equal(result.data.after,before+1);
  const rows=await pool.query(`SELECT mp.user_id FROM meal_plan_item m JOIN meal_plan mp USING(plan_id)
    WHERE mp.user_id IN ($1,$2)`,[first.user_id,second.user_id]);
  assert.deepEqual(rows.rows.map(x=>x.user_id),[first.user_id]);
  assert.equal((await request('/api/plan',{method:'POST',headers:{Cookie:cookie},body:{recipe_id:999999}})).response.status,404);
  assert.equal((await request('/api/plan',{method:'POST',headers:{Cookie:cookie},body:{recipe_id:'abc'}})).response.status,400);
});
test('personal SQL reports do not reveal other users activity', async () => {
  const result=await request('/api/reports',{headers:{Cookie:cookie}});
  assert.equal(result.response.status,200);assert.equal(result.data.length,6);
  assert.ok(result.data[4].rows.every(x=>x.user_name===first.name));
  assert.deepEqual(result.data[5].rows.map(x=>x.name),[first.name]);
});
test('logout revokes cookie in the database and expired sessions cannot authenticate', async () => {
  assert.equal((await request('/api/auth/logout',{method:'POST',headers:{Cookie:cookie},body:{}})).response.status,200);
  assert.equal((await request('/api/auth/me',{headers:{Cookie:cookie}})).response.status,401);
  await pool.query(`UPDATE app_session SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE user_id=$1`,[second.user_id]);
  assert.equal((await request('/api/auth/me',{headers:{Cookie:otherCookie}})).response.status,401);
});
