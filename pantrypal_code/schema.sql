-- ============================================================
-- PantryPal : PostgreSQL (RDBMS side)
-- 8 tables, 1 trigger, 2 functions, 1 view, indexes
-- ============================================================

DROP TABLE IF EXISTS rating, meal_plan_item, meal_plan, pantry_item,
                     recipe_ingredient, ingredient, recipe, app_user CASCADE;

-- 1. USERS (roles: admin / user)
CREATE TABLE app_user (
    user_id     SERIAL PRIMARY KEY,
    name        VARCHAR(80)  NOT NULL,
    email       VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role        VARCHAR(10)  NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
    diet_pref   VARCHAR(15)  NOT NULL DEFAULT 'any' CHECK (diet_pref IN ('any','veg','vegan','non-veg')),
    created_at  TIMESTAMP    NOT NULL DEFAULT now()
);

-- 2. RECIPES
CREATE TABLE recipe (
    recipe_id    SERIAL PRIMARY KEY,
    title        VARCHAR(120) NOT NULL,
    cuisine      VARCHAR(40),
    diet_type    VARCHAR(10)  NOT NULL CHECK (diet_type IN ('veg','vegan','non-veg')),
    prep_minutes INT          NOT NULL CHECK (prep_minutes > 0),
    instructions TEXT         NOT NULL,
    calories     INT          CHECK (calories >= 0),
    times_cooked INT          NOT NULL DEFAULT 0,
    created_by   INT          REFERENCES app_user(user_id) ON DELETE SET NULL
);

-- 3. INGREDIENTS (master list)
CREATE TABLE ingredient (
    ingredient_id SERIAL PRIMARY KEY,
    name          VARCHAR(60) NOT NULL UNIQUE,
    category      VARCHAR(30) NOT NULL,          -- vegetable, grain, dairy, spice ...
    shelf_life_days INT       NOT NULL CHECK (shelf_life_days > 0)
);

-- 4. RECIPE <-> INGREDIENT  (many-to-many)
CREATE TABLE recipe_ingredient (
    recipe_id     INT NOT NULL REFERENCES recipe(recipe_id) ON DELETE CASCADE,
    ingredient_id INT NOT NULL REFERENCES ingredient(ingredient_id) ON DELETE RESTRICT,
    quantity      VARCHAR(30) NOT NULL,
    is_optional   BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (recipe_id, ingredient_id)
);

-- 5. PANTRY (what each user currently has + when it was bought)
CREATE TABLE pantry_item (
    pantry_id     SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    ingredient_id INT NOT NULL REFERENCES ingredient(ingredient_id) ON DELETE CASCADE,
    purchased_on  DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity      VARCHAR(30),
    UNIQUE (user_id, ingredient_id)
);

-- 6. MEAL PLAN (header)
CREATE TABLE meal_plan (
    plan_id    SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    plan_name  VARCHAR(60) NOT NULL,
    week_start DATE NOT NULL
);

-- 7. MEAL PLAN ITEMS (recipes inside a plan)
CREATE TABLE meal_plan_item (
    item_id      SERIAL PRIMARY KEY,
    plan_id      INT NOT NULL REFERENCES meal_plan(plan_id) ON DELETE CASCADE,
    recipe_id    INT NOT NULL REFERENCES recipe(recipe_id) ON DELETE CASCADE,
    planned_date DATE NOT NULL,
    meal_slot    VARCHAR(10) NOT NULL CHECK (meal_slot IN ('breakfast','lunch','dinner'))
);

-- 8. RATINGS
CREATE TABLE rating (
    rating_id  SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    recipe_id  INT NOT NULL REFERENCES recipe(recipe_id) ON DELETE CASCADE,
    score      INT NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment    TEXT,
    rated_on   DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (user_id, recipe_id)
);

-- ---------- Indexes ----------
CREATE INDEX idx_recipe_cuisine   ON recipe(cuisine);
CREATE INDEX idx_pantry_user      ON pantry_item(user_id);
CREATE INDEX idx_ri_ingredient    ON recipe_ingredient(ingredient_id);
CREATE INDEX idx_mpi_plan         ON meal_plan_item(plan_id);

-- ============================================================
-- TRIGGER: when a recipe is added to a meal plan, bump times_cooked
-- ============================================================
CREATE OR REPLACE FUNCTION fn_bump_times_cooked() RETURNS trigger AS $$
BEGIN
    UPDATE recipe SET times_cooked = times_cooked + 1
    WHERE recipe_id = NEW.recipe_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_meal_plan_item_insert
AFTER INSERT ON meal_plan_item
FOR EACH ROW EXECUTE FUNCTION fn_bump_times_cooked();

-- ============================================================
-- NOVELTY: expiry-aware pantry view
-- days_left = shelf_life - days since purchase
-- ============================================================
CREATE OR REPLACE VIEW v_pantry_expiry AS
SELECT p.user_id,
       p.ingredient_id,
       i.name AS ingredient,
       p.purchased_on,
       i.shelf_life_days,
       (i.shelf_life_days - (CURRENT_DATE - p.purchased_on)) AS days_left
FROM pantry_item p
JOIN ingredient i USING (ingredient_id);

-- ============================================================
-- NOVELTY FUNCTION: rank recipes for a user by
--   coverage  = % of non-optional ingredients the user has
--   urgency   = how soon the matched ingredients expire
-- score = coverage*0.7 + urgency*0.3   (higher = cook this first)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_rank_recipes(p_user INT)
RETURNS TABLE (recipe_id INT, title VARCHAR, have_cnt BIGINT, need_cnt BIGINT,
               coverage NUMERIC, urgency NUMERIC, score NUMERIC) AS $$
    WITH need AS (
        SELECT ri.recipe_id, COUNT(*) AS need_cnt
        FROM recipe_ingredient ri
        WHERE NOT ri.is_optional
        GROUP BY ri.recipe_id
    ),
    have AS (
        SELECT ri.recipe_id,
               COUNT(*) AS have_cnt,
               AVG(GREATEST(0, LEAST(1, 1 - v.days_left / 7.0))) AS urgency
        FROM recipe_ingredient ri
        JOIN v_pantry_expiry v
          ON v.ingredient_id = ri.ingredient_id AND v.user_id = p_user
        WHERE NOT ri.is_optional AND v.days_left >= 0
        GROUP BY ri.recipe_id
    )
    SELECT r.recipe_id, r.title, h.have_cnt, n.need_cnt,
           ROUND(h.have_cnt::numeric / n.need_cnt, 2),
           ROUND(h.urgency::numeric, 2),
           ROUND((h.have_cnt::numeric / n.need_cnt) * 0.7 + h.urgency::numeric * 0.3, 3)
    FROM recipe r
    JOIN need n USING (recipe_id)
    JOIN have h USING (recipe_id)
    JOIN app_user u ON u.user_id = p_user
    -- respect the user's diet preference
    WHERE CASE u.diet_pref
            WHEN 'veg'   THEN r.diet_type IN ('veg','vegan')
            WHEN 'vegan' THEN r.diet_type = 'vegan'
            ELSE TRUE
          END
    ORDER BY 7 DESC, r.title;
$$ LANGUAGE sql STABLE;
