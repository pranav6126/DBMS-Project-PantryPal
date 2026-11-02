// ============================================================
// PantryPal : MongoDB (NoSQL side)  -- run with:  mongosh mongo_setup.js
//
// WHY MONGODB? These two collections hold flexible, fast-growing,
// schema-less data that does not fit neatly into relational tables:
//   1. search_logs     - every ingredient search a user makes (variable-length arrays)
//   2. cooking_journal - free-form notes, tags, substitutions per cooking session
// PostgreSQL keeps the core, consistent data (users, recipes, pantry, plans).
// Link between the two: user_id / recipe_id (same IDs as PostgreSQL).
// ============================================================

use("pantrypal_nosql");

db.search_logs.drop();
db.cooking_journal.drop();

// ---------- 1. search_logs ----------
db.search_logs.insertMany([
  { user_id: 2, searched_at: new Date("2026-10-20T19:10:00Z"),
    ingredients: ["paneer", "capsicum", "cooked rice"], top_result: "Paneer Fried Rice",
    results_returned: 5, clicked_recipe_id: 1, device: "mobile" },
  { user_id: 2, searched_at: new Date("2026-10-21T13:05:00Z"),
    ingredients: ["spinach", "paneer"], top_result: "Palak Paneer",
    results_returned: 3, clicked_recipe_id: 9, device: "web" },
  { user_id: 2, searched_at: new Date("2026-10-23T20:30:00Z"),
    ingredients: ["potato", "cumin"], top_result: "Aloo Jeera",
    results_returned: 2, clicked_recipe_id: null, device: "mobile" },
  { user_id: 3, searched_at: new Date("2026-10-20T08:00:00Z"),
    ingredients: ["egg", "onion", "tomato"], top_result: "Masala Omelette",
    results_returned: 4, clicked_recipe_id: 11, device: "mobile" },
  { user_id: 3, searched_at: new Date("2026-10-22T09:15:00Z"),
    ingredients: ["bread", "cheese", "butter"], top_result: "Cheese Toast",
    results_returned: 2, clicked_recipe_id: 8, device: "web" },
  { user_id: 3, searched_at: new Date("2026-10-24T12:40:00Z"),
    ingredients: ["curd", "cooked rice"], top_result: "Curd Rice",
    results_returned: 2, clicked_recipe_id: 10, device: "mobile" },
  { user_id: 4, searched_at: new Date("2026-10-19T18:20:00Z"),
    ingredients: ["chicken", "onion", "tomato", "ginger"], top_result: "Chicken Curry",
    results_returned: 3, clicked_recipe_id: 5, device: "web" },
  { user_id: 4, searched_at: new Date("2026-10-23T07:50:00Z"),
    ingredients: ["egg", "onion"], top_result: "Masala Omelette",
    results_returned: 4, clicked_recipe_id: 11, device: "mobile" },
  { user_id: 4, searched_at: new Date("2026-10-25T21:00:00Z"),
    ingredients: ["egg", "cooked rice", "capsicum"], top_result: "Egg Fried Rice",
    results_returned: 3, clicked_recipe_id: 6, device: "web" }
]);

// ---------- 2. cooking_journal ----------
db.cooking_journal.insertMany([
  { user_id: 2, recipe_id: 2, cooked_on: new Date("2026-10-21"),
    tags: ["dinner", "family"], difficulty: "easy", minutes_taken: 28,
    substitutions: [{ original: "garam masala", used: "chaat masala" }],
    notes: "Added extra capsicum. Tasted better the next day." },
  { user_id: 2, recipe_id: 9, cooked_on: new Date("2026-10-22"),
    tags: ["dinner", "healthy"], difficulty: "medium", minutes_taken: 40,
    substitutions: [], notes: "Blanch spinach for only 2 minutes to keep the colour." },
  { user_id: 3, recipe_id: 11, cooked_on: new Date("2026-10-20"),
    tags: ["breakfast", "quick"], difficulty: "easy", minutes_taken: 8,
    substitutions: [{ original: "green chilli", used: "red chilli flakes" }],
    notes: "Kids wanted it less spicy." },
  { user_id: 3, recipe_id: 8, cooked_on: new Date("2026-10-22"),
    tags: ["breakfast", "kids"], difficulty: "easy", minutes_taken: 7,
    substitutions: [], notes: "Used an air fryer instead of a grill." },
  { user_id: 4, recipe_id: 5, cooked_on: new Date("2026-10-19"),
    tags: ["dinner", "weekend"], difficulty: "hard", minutes_taken: 55,
    substitutions: [{ original: "tomato", used: "curd" }],
    notes: "Curd made the gravy creamier." },
  { user_id: 4, recipe_id: 6, cooked_on: new Date("2026-10-25"),
    tags: ["lunch", "quick"], difficulty: "easy", minutes_taken: 15,
    substitutions: [], notes: "Day-old rice works best." }
]);

// ---------- Indexes ----------
db.search_logs.createIndex({ user_id: 1, searched_at: -1 });
db.search_logs.createIndex({ ingredients: 1 });           // multikey index on an array
db.cooking_journal.createIndex({ recipe_id: 1 });
db.cooking_journal.createIndex({ tags: 1 });

print("search_logs:", db.search_logs.countDocuments(),
      " cooking_journal:", db.cooking_journal.countDocuments());
