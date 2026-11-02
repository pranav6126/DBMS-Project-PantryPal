// ============================================================
// PantryPal MongoDB REPORTS (aggregation pipelines)  -- mongosh mongo_reports.js
// ============================================================
use("pantrypal_nosql");

print("\n--- M1. Most searched ingredients (what users have most often) ---");
printjson(db.search_logs.aggregate([
  { $unwind: "$ingredients" },
  { $group: { _id: "$ingredients", times_searched: { $sum: 1 } } },
  { $sort: { times_searched: -1, _id: 1 } },
  { $limit: 5 }
]).toArray());

print("\n--- M2. Searches per user, with click-through rate ---");
printjson(db.search_logs.aggregate([
  { $group: {
      _id: "$user_id",
      searches: { $sum: 1 },
      clicks: { $sum: { $cond: [{ $ne: ["$clicked_recipe_id", null] }, 1, 0] } } } },
  { $project: { searches: 1, clicks: 1,
      click_rate_pct: { $round: [{ $multiply: [{ $divide: ["$clicks", "$searches"] }, 100] }, 1] } } },
  { $sort: { _id: 1 } }
]).toArray());

print("\n--- M3. Average cooking time and entries per difficulty ---");
printjson(db.cooking_journal.aggregate([
  { $group: { _id: "$difficulty", entries: { $sum: 1 },
              avg_minutes: { $avg: "$minutes_taken" } } },
  { $project: { entries: 1, avg_minutes: { $round: ["$avg_minutes", 1] } } },
  { $sort: { avg_minutes: 1 } }
]).toArray());

print("\n--- M4. Most common ingredient substitutions ---");
printjson(db.cooking_journal.aggregate([
  { $unwind: "$substitutions" },
  { $group: { _id: { original: "$substitutions.original", used: "$substitutions.used" },
              times: { $sum: 1 } } },
  { $sort: { times: -1 } }
]).toArray());

print("\n--- M5. Journal tag popularity ---");
printjson(db.cooking_journal.aggregate([
  { $unwind: "$tags" },
  { $group: { _id: "$tags", entries: { $sum: 1 } } },
  { $sort: { entries: -1, _id: 1 } }
]).toArray());

print("\n--- M6. Searches that led to NO click (recipes users could not find) ---");
printjson(db.search_logs.find(
  { clicked_recipe_id: null },
  { _id: 0, user_id: 1, ingredients: 1, results_returned: 1 }
).toArray());

// ------------------------------------------------------------
// CROSS-DATABASE LINK (how PostgreSQL and MongoDB work together):
// 1. Postgres  -> fn_rank_recipes(user_id) returns the ranked recipes.
// 2. Express API then writes the search into Mongo search_logs
//    { user_id, ingredients, top_result, ... } using the same user_id.
// 3. The authenticated MongoDB reports route summarizes cooking_journal.
//    Regular users see their own documents; admins see all users.
// ------------------------------------------------------------
