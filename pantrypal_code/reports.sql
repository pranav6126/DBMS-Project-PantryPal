-- ============================================================
-- PantryPal REPORTS (for the project demo)
-- ============================================================

-- R1. Average rating and number of ratings per cuisine
SELECT r.cuisine,
       COUNT(rt.rating_id)            AS total_ratings,
       ROUND(AVG(rt.score), 2)        AS avg_rating
FROM recipe r
JOIN rating rt ON rt.recipe_id = r.recipe_id
GROUP BY r.cuisine
ORDER BY avg_rating DESC;

-- R2. Average calories and prep time per diet type
SELECT diet_type,
       COUNT(*)                       AS recipes,
       ROUND(AVG(calories))           AS avg_calories,
       ROUND(AVG(prep_minutes), 1)    AS avg_prep_minutes
FROM recipe
GROUP BY diet_type
ORDER BY avg_calories DESC;

-- R3. Top 5 most-planned recipes (times_cooked is maintained by the trigger)
SELECT title, cuisine, times_cooked
FROM recipe
ORDER BY times_cooked DESC, title
LIMIT 5;

-- R4. Most-used ingredients across recipes
SELECT i.name, i.category, COUNT(*) AS used_in_recipes
FROM ingredient i
JOIN recipe_ingredient ri USING (ingredient_id)
GROUP BY i.ingredient_id, i.name, i.category
ORDER BY used_in_recipes DESC, i.name
LIMIT 8;

-- R5. Pantry items that expire within 3 days, per user (food-waste alert)
SELECT u.name AS user_name, v.ingredient, v.days_left
FROM v_pantry_expiry v
JOIN app_user u USING (user_id)
WHERE v.days_left BETWEEN 0 AND 3
ORDER BY v.days_left, u.name;

-- R6. Users with their average given rating and number of meal-plan items
SELECT u.name,
       COALESCE(ROUND(AVG(rt.score), 2), 0) AS avg_rating_given,
       (SELECT COUNT(*) FROM meal_plan mp
          JOIN meal_plan_item mpi USING (plan_id)
         WHERE mp.user_id = u.user_id)       AS planned_meals
FROM app_user u
LEFT JOIN rating rt ON rt.user_id = u.user_id
WHERE u.role = 'user'
GROUP BY u.user_id, u.name
ORDER BY planned_meals DESC;

-- ============================================================
-- NOVELTY DEMO: "what should I cook tonight?" ranked by pantry
-- coverage AND how soon the matched ingredients expire.
-- ============================================================
-- Aarav's ranking
SELECT * FROM fn_rank_recipes((SELECT user_id FROM app_user WHERE email='aarav@example.com'))
LIMIT 5;

-- Same recipes for Meera -> different order, because her pantry differs
SELECT * FROM fn_rank_recipes((SELECT user_id FROM app_user WHERE email='meera@example.com'))
LIMIT 5;

-- Missing-ingredient shopping list for a chosen recipe (Aarav, Veg Pasta)
SELECT i.name AS missing_ingredient, ri.quantity
FROM recipe_ingredient ri
JOIN ingredient i USING (ingredient_id)
WHERE ri.recipe_id = (SELECT recipe_id FROM recipe WHERE title = 'Veg Pasta')
  AND NOT ri.is_optional
  AND ri.ingredient_id NOT IN (
        SELECT ingredient_id FROM pantry_item
        WHERE user_id = (SELECT user_id FROM app_user WHERE email='aarav@example.com'));
