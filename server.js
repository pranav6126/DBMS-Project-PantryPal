// PantryPal web app: Express API over PostgreSQL (core data) + MongoDB (logs/journal)
// Run:  npm install && node server.js   ->  http://localhost:3000
const express = require("express");
const { Pool } = require("pg");
const { MongoClient } = require("mongodb");

const app = express();
app.use(express.json());
app.use(express.static(__dirname + "/public"));

// ---------- PostgreSQL ----------
// Uses your normal PG* environment variables; defaults to database "pantrypal"
// and your own OS user, which is what `createdb pantrypal` set up on a Mac.
const pool = new Pool({ database: process.env.PGDATABASE || "pantrypal" });

// ---------- MongoDB (optional: the app still works if it is not running) ----------
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017";
let mongoDb = null;
let mongoTried = 0;
async function getMongo() {
  if (mongoDb) return mongoDb;
  if (Date.now() - mongoTried < 5000) return null; // do not retry on every request
  mongoTried = Date.now();
  try {
    const c = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 1200 });
    await c.connect();
    mongoDb = c.db("pantrypal_nosql");
    return mongoDb;
  } catch (e) {
    return null;
  }
}

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e.message);
    res.status(500).json({ error: e.message });
  });

// ---------- API ----------
app.get("/api/users", wrap(async (req, res) => {
  const r = await pool.query(
    "SELECT user_id, name, diet_pref FROM app_user WHERE role='user' ORDER BY user_id");
  res.json(r.rows);
}));

app.get("/api/pantry/:uid", wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT ingredient, days_left, shelf_life_days, purchased_on
       FROM v_pantry_expiry WHERE user_id=$1 ORDER BY days_left, ingredient`,
    [req.params.uid]);
  res.json(r.rows);
}));

// The novelty feature: ranked recipes. Also logs the search into MongoDB.
app.get("/api/rank/:uid", wrap(async (req, res) => {
  const uid = Number(req.params.uid);
  const rank = await pool.query(
    `SELECT f.recipe_id, f.title, f.have_cnt::int AS have_cnt, f.need_cnt::int AS need_cnt,
            f.coverage::float AS coverage, f.urgency::float AS urgency, f.score::float AS score,
            r.cuisine, r.diet_type, r.prep_minutes, r.calories, r.times_cooked
       FROM fn_rank_recipes($1) f JOIN recipe r USING (recipe_id)
      LIMIT 8`, [uid]);
  const pantry = await pool.query(
    `SELECT ingredient FROM v_pantry_expiry WHERE user_id=$1 AND days_left >= 0`, [uid]);

  let logged = false;
  const db = await getMongo();
  if (db) {
    try {
      await db.collection("search_logs").insertOne({
        user_id: uid, searched_at: new Date(),
        ingredients: pantry.rows.map((p) => p.ingredient.toLowerCase()),
        top_result: rank.rows[0] ? rank.rows[0].title : null,
        results_returned: rank.rows.length, clicked_recipe_id: null, device: "web",
      });
      logged = true;
    } catch (e) { /* logging must never break the page */ }
  }
  res.json({ recipes: rank.rows, loggedToMongo: logged });
}));

app.get("/api/missing/:uid/:rid", wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT i.name AS ingredient, ri.quantity
       FROM recipe_ingredient ri JOIN ingredient i USING (ingredient_id)
      WHERE ri.recipe_id=$2 AND NOT ri.is_optional
        AND ri.ingredient_id NOT IN
            (SELECT ingredient_id FROM pantry_item WHERE user_id=$1)
      ORDER BY i.name`, [req.params.uid, req.params.rid]);
  res.json(r.rows);
}));

// Add a recipe to the user's meal plan. The DB trigger bumps recipe.times_cooked.
app.post("/api/plan", wrap(async (req, res) => {
  const { user_id, recipe_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN"); // transaction: plan lookup + insert succeed together
    const plan = await client.query(
      "SELECT plan_id FROM meal_plan WHERE user_id=$1 ORDER BY plan_id LIMIT 1", [user_id]);
    if (!plan.rows.length) throw new Error("This user has no meal plan");
    const before = await client.query("SELECT times_cooked FROM recipe WHERE recipe_id=$1", [recipe_id]);
    await client.query(
      `INSERT INTO meal_plan_item (plan_id, recipe_id, planned_date, meal_slot)
       VALUES ($1, $2, CURRENT_DATE + 1, 'dinner')`, [plan.rows[0].plan_id, recipe_id]);
    const after = await client.query("SELECT title, times_cooked FROM recipe WHERE recipe_id=$1", [recipe_id]);
    await client.query("COMMIT");

    const db = await getMongo(); // mark the latest search as "clicked"
    if (db) {
      try {
        await db.collection("search_logs").findOneAndUpdate(
          { user_id: Number(user_id), clicked_recipe_id: null },
          { $set: { clicked_recipe_id: Number(recipe_id) } },
          { sort: { searched_at: -1 } });
      } catch (e) {}
    }
    res.json({ title: after.rows[0].title, before: before.rows[0].times_cooked,
               after: after.rows[0].times_cooked });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}));

const REPORTS = [
  ["Average rating per cuisine",
   `SELECT r.cuisine, COUNT(rt.rating_id)::int AS ratings, ROUND(AVG(rt.score),2)::float AS avg_rating
      FROM recipe r JOIN rating rt USING (recipe_id) GROUP BY r.cuisine ORDER BY avg_rating DESC`],
  ["Average calories and prep time per diet type",
   `SELECT diet_type, COUNT(*)::int AS recipes, ROUND(AVG(calories))::int AS avg_calories,
           ROUND(AVG(prep_minutes),1)::float AS avg_prep_min
      FROM recipe GROUP BY diet_type ORDER BY avg_calories DESC`],
  ["Most-planned recipes (counter kept by trigger)",
   `SELECT title, cuisine, times_cooked FROM recipe ORDER BY times_cooked DESC, title LIMIT 5`],
  ["Most-used ingredients",
   `SELECT i.name, i.category, COUNT(*)::int AS used_in_recipes
      FROM ingredient i JOIN recipe_ingredient USING (ingredient_id)
     GROUP BY i.ingredient_id, i.name, i.category ORDER BY used_in_recipes DESC, i.name LIMIT 8`],
  ["Pantry items expiring within 3 days",
   `SELECT u.name AS user_name, v.ingredient, v.days_left
      FROM v_pantry_expiry v JOIN app_user u USING (user_id)
     WHERE v.days_left BETWEEN 0 AND 3 ORDER BY v.days_left, u.name`],
  ["Per user: average rating given and planned meals",
   `SELECT u.name, COALESCE(ROUND(AVG(rt.score),2),0)::float AS avg_rating_given,
           (SELECT COUNT(*) FROM meal_plan mp JOIN meal_plan_item mpi USING (plan_id)
             WHERE mp.user_id = u.user_id)::int AS planned_meals
      FROM app_user u LEFT JOIN rating rt ON rt.user_id = u.user_id
     WHERE u.role='user' GROUP BY u.user_id, u.name ORDER BY planned_meals DESC`],
];

app.get("/api/reports", wrap(async (req, res) => {
  const out = [];
  for (const [title, sql] of REPORTS) {
    const r = await pool.query(sql);
    out.push({ title, columns: r.fields.map((f) => f.name), rows: r.rows });
  }
  res.json(out);
}));

app.get("/api/mongo", wrap(async (req, res) => {
  const db = await getMongo();
  if (!db) return res.json({ available: false });
  const logs = db.collection("search_logs");
  const journal = db.collection("cooking_journal");
  const reports = [
    { title: "Most searched ingredients",
      rows: await logs.aggregate([
        { $unwind: "$ingredients" },
        { $group: { _id: "$ingredients", times_searched: { $sum: 1 } } },
        { $sort: { times_searched: -1, _id: 1 } }, { $limit: 6 },
        { $project: { _id: 0, ingredient: "$_id", times_searched: 1 } }]).toArray() },
    { title: "Searches and click-through rate per user",
      rows: await logs.aggregate([
        { $group: { _id: "$user_id", searches: { $sum: 1 },
            clicks: { $sum: { $cond: [{ $ne: ["$clicked_recipe_id", null] }, 1, 0] } } } },
        { $project: { _id: 0, user_id: "$_id", searches: 1, clicks: 1,
            click_rate_pct: { $round: [{ $multiply: [{ $divide: ["$clicks", "$searches"] }, 100] }, 1] } } },
        { $sort: { user_id: 1 } }]).toArray() },
    { title: "Average cooking time per difficulty (journal)",
      rows: await journal.aggregate([
        { $group: { _id: "$difficulty", entries: { $sum: 1 }, avg_minutes: { $avg: "$minutes_taken" } } },
        { $project: { _id: 0, difficulty: "$_id", entries: 1, avg_minutes: { $round: ["$avg_minutes", 1] } } },
        { $sort: { avg_minutes: 1 } }]).toArray() },
  ];
  res.json({ available: true, reports });
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PantryPal running at http://localhost:${PORT}`));
