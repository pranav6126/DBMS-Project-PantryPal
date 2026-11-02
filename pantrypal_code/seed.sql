-- Run npm run setup:demo after seeding to provision local passwords.
-- ============================================================
-- PantryPal sample data
-- ============================================================

INSERT INTO app_user (name, email, password_hash, role, diet_pref) VALUES
 ('Admin Curator', 'admin@pantrypal.com',  '!disabled',  'admin', 'any'),
 ('Aarav Nair',    'aarav@example.com',    '!disabled',  'user',  'veg'),
 ('Meera Iyer',    'meera@example.com',    '!disabled',  'user',  'any'),
 ('Rohan Das',     'rohan@example.com',    '!disabled',  'user',  'non-veg');

INSERT INTO ingredient (name, category, shelf_life_days) VALUES
 ('Paneer',        'dairy',     6),
 ('Capsicum',      'vegetable', 7),
 ('Cooked Rice',   'grain',     3),
 ('Onion',         'vegetable', 30),
 ('Tomato',        'vegetable', 7),
 ('Potato',        'vegetable', 30),
 ('Spinach',       'vegetable', 4),
 ('Egg',           'protein',   21),
 ('Chicken',       'protein',   3),
 ('Milk',          'dairy',     5),
 ('Curd',          'dairy',     7),
 ('Bread',         'grain',     5),
 ('Pasta',         'grain',     365),
 ('Garlic',        'vegetable', 45),
 ('Ginger',        'vegetable', 30),
 ('Green Chilli',  'vegetable', 10),
 ('Cumin',         'spice',     365),
 ('Turmeric',      'spice',     365),
 ('Garam Masala',  'spice',     365),
 ('Oil',           'staple',    365),
 ('Butter',        'dairy',     30),
 ('Cheese',        'dairy',     20),
 ('Carrot',        'vegetable', 14),
 ('Peas',          'vegetable', 7),
 ('Lemon',         'fruit',     14);

INSERT INTO recipe (title, cuisine, diet_type, prep_minutes, instructions, calories, created_by) VALUES
 ('Paneer Fried Rice',      'Indo-Chinese', 'veg',     20, 'Stir fry paneer, capsicum and onion; toss with cooked rice and spices.', 480, 1),
 ('Paneer Capsicum Masala', 'North Indian', 'veg',     25, 'Cook onion-tomato gravy, add paneer and capsicum cubes, finish with garam masala.', 420, 1),
 ('Aloo Jeera',             'North Indian', 'vegan',   20, 'Temper cumin, add boiled potato cubes with turmeric and green chilli.', 260, 1),
 ('Spinach Egg Scramble',   'Continental',  'non-veg', 10, 'Saute garlic and spinach, scramble eggs in.', 230, 1),
 ('Chicken Curry',          'North Indian', 'non-veg', 40, 'Brown onion, add ginger-garlic, tomato, chicken and spices; simmer.', 520, 1),
 ('Egg Fried Rice',         'Indo-Chinese', 'non-veg', 15, 'Scramble egg, add cooked rice, onion, capsicum and soy.', 430, 1),
 ('Veg Pasta',              'Italian',      'veg',     20, 'Boil pasta; saute garlic, tomato, capsicum and carrot; toss with cheese.', 450, 1),
 ('Cheese Toast',           'Continental',  'veg',      8, 'Butter the bread, top with cheese and grill.', 310, 1),
 ('Palak Paneer',           'North Indian', 'veg',     30, 'Blend blanched spinach; cook with onion, tomato, ginger-garlic and paneer.', 380, 1),
 ('Curd Rice',              'South Indian', 'veg',     10, 'Mix cooked rice with curd, temper with cumin and green chilli.', 290, 1),
 ('Masala Omelette',        'Indian',       'non-veg', 10, 'Whisk eggs with onion, tomato, green chilli; fry.', 210, 1),
 ('Vegetable Pulao',        'North Indian', 'vegan',   30, 'Cook rice with peas, carrot, onion and whole spices.', 340, 1);

-- recipe_ingredient (recipe_id, ingredient_id, qty, optional)
INSERT INTO recipe_ingredient (recipe_id, ingredient_id, quantity, is_optional)
SELECT r.recipe_id, i.ingredient_id, x.qty, x.opt
FROM (VALUES
 ('Paneer Fried Rice','Paneer','200 g',false), ('Paneer Fried Rice','Capsicum','1',false),
 ('Paneer Fried Rice','Cooked Rice','2 cups',false), ('Paneer Fried Rice','Onion','1',false),
 ('Paneer Fried Rice','Oil','2 tbsp',false), ('Paneer Fried Rice','Garlic','3 cloves',true),

 ('Paneer Capsicum Masala','Paneer','250 g',false), ('Paneer Capsicum Masala','Capsicum','2',false),
 ('Paneer Capsicum Masala','Onion','2',false), ('Paneer Capsicum Masala','Tomato','2',false),
 ('Paneer Capsicum Masala','Garam Masala','1 tsp',false), ('Paneer Capsicum Masala','Oil','2 tbsp',false),

 ('Aloo Jeera','Potato','3',false), ('Aloo Jeera','Cumin','1 tsp',false),
 ('Aloo Jeera','Turmeric','1/2 tsp',false), ('Aloo Jeera','Green Chilli','2',false), ('Aloo Jeera','Oil','2 tbsp',false),

 ('Spinach Egg Scramble','Spinach','2 cups',false), ('Spinach Egg Scramble','Egg','3',false),
 ('Spinach Egg Scramble','Garlic','2 cloves',false), ('Spinach Egg Scramble','Butter','1 tbsp',true),

 ('Chicken Curry','Chicken','500 g',false), ('Chicken Curry','Onion','2',false), ('Chicken Curry','Tomato','2',false),
 ('Chicken Curry','Ginger','1 inch',false), ('Chicken Curry','Garlic','4 cloves',false),
 ('Chicken Curry','Garam Masala','2 tsp',false), ('Chicken Curry','Oil','3 tbsp',false),

 ('Egg Fried Rice','Egg','2',false), ('Egg Fried Rice','Cooked Rice','2 cups',false),
 ('Egg Fried Rice','Onion','1',false), ('Egg Fried Rice','Capsicum','1',false), ('Egg Fried Rice','Oil','2 tbsp',false),

 ('Veg Pasta','Pasta','200 g',false), ('Veg Pasta','Garlic','3 cloves',false), ('Veg Pasta','Tomato','2',false),
 ('Veg Pasta','Capsicum','1',false), ('Veg Pasta','Carrot','1',false), ('Veg Pasta','Cheese','50 g',true),

 ('Cheese Toast','Bread','4 slices',false), ('Cheese Toast','Cheese','60 g',false), ('Cheese Toast','Butter','1 tbsp',false),

 ('Palak Paneer','Spinach','4 cups',false), ('Palak Paneer','Paneer','200 g',false), ('Palak Paneer','Onion','1',false),
 ('Palak Paneer','Tomato','1',false), ('Palak Paneer','Ginger','1 inch',false), ('Palak Paneer','Garlic','3 cloves',false),

 ('Curd Rice','Cooked Rice','2 cups',false), ('Curd Rice','Curd','1 cup',false),
 ('Curd Rice','Cumin','1/2 tsp',false), ('Curd Rice','Green Chilli','1',true),

 ('Masala Omelette','Egg','3',false), ('Masala Omelette','Onion','1',false),
 ('Masala Omelette','Tomato','1',false), ('Masala Omelette','Green Chilli','1',false),

 ('Vegetable Pulao','Cooked Rice','2 cups',false), ('Vegetable Pulao','Peas','1/2 cup',false),
 ('Vegetable Pulao','Carrot','1',false), ('Vegetable Pulao','Onion','1',false), ('Vegetable Pulao','Oil','2 tbsp',false)
) AS x(rtitle, iname, qty, opt)
JOIN recipe r ON r.title = x.rtitle
JOIN ingredient i ON i.name = x.iname;

-- Pantries. purchased_on is relative to today so expiry urgency is meaningful.
INSERT INTO pantry_item (user_id, ingredient_id, purchased_on, quantity)
SELECT u.user_id, i.ingredient_id, CURRENT_DATE - x.days_ago, x.qty
FROM (VALUES
 -- Aarav (veg): paneer is 5 days old (shelf life 6) -> urgent
 ('aarav@example.com','Paneer',5,'250 g'), ('aarav@example.com','Capsicum',3,'3'),
 ('aarav@example.com','Cooked Rice',1,'3 cups'), ('aarav@example.com','Onion',4,'4'),
 ('aarav@example.com','Tomato',2,'4'), ('aarav@example.com','Oil',20,'1 L'),
 ('aarav@example.com','Garam Masala',60,'1 pack'), ('aarav@example.com','Spinach',3,'1 bunch'),
 ('aarav@example.com','Ginger',5,'1 piece'), ('aarav@example.com','Garlic',8,'1 bulb'),
 -- Meera (any)
 ('meera@example.com','Egg',4,'6'), ('meera@example.com','Onion',6,'3'),
 ('meera@example.com','Tomato',5,'3'), ('meera@example.com','Green Chilli',4,'5'),
 ('meera@example.com','Bread',3,'1 loaf'), ('meera@example.com','Butter',10,'100 g'),
 ('meera@example.com','Cheese',6,'100 g'), ('meera@example.com','Cooked Rice',2,'2 cups'),
 ('meera@example.com','Curd',5,'500 g'), ('meera@example.com','Cumin',90,'1 pack'),
 -- Rohan (non-veg)
 ('rohan@example.com','Chicken',2,'500 g'), ('rohan@example.com','Onion',3,'3'),
 ('rohan@example.com','Tomato',3,'3'), ('rohan@example.com','Ginger',6,'1 piece'),
 ('rohan@example.com','Garlic',6,'1 bulb'), ('rohan@example.com','Garam Masala',40,'1 pack'),
 ('rohan@example.com','Oil',15,'1 L'), ('rohan@example.com','Egg',7,'6')
) AS x(email, iname, days_ago, qty)
JOIN app_user u  ON u.email = x.email
JOIN ingredient i ON i.name = x.iname;

-- Ratings
INSERT INTO rating (user_id, recipe_id, score, comment)
SELECT u.user_id, r.recipe_id, x.score, x.cmt
FROM (VALUES
 ('aarav@example.com','Paneer Capsicum Masala',5,'Great with rotis'),
 ('aarav@example.com','Palak Paneer',4,'Good'),
 ('aarav@example.com','Paneer Fried Rice',4,'Quick dinner'),
 ('meera@example.com','Masala Omelette',5,'Perfect breakfast'),
 ('meera@example.com','Cheese Toast',4,'Kids loved it'),
 ('meera@example.com','Curd Rice',5,'Comfort food'),
 ('rohan@example.com','Chicken Curry',5,'Spot on'),
 ('rohan@example.com','Masala Omelette',3,'Needs more spice'),
 ('rohan@example.com','Egg Fried Rice',4,'Nice')
) AS x(email, rtitle, score, cmt)
JOIN app_user u ON u.email = x.email
JOIN recipe r   ON r.title = x.rtitle;

-- Meal plans. The trigger bumps recipe.times_cooked on each item insert.
INSERT INTO meal_plan (user_id, plan_name, week_start)
SELECT user_id, x.pname, CURRENT_DATE
FROM (VALUES ('aarav@example.com','Aarav - this week'),
             ('meera@example.com','Meera - quick meals'),
             ('rohan@example.com','Rohan - protein week')) AS x(email, pname)
JOIN app_user USING (email);

INSERT INTO meal_plan_item (plan_id, recipe_id, planned_date, meal_slot)
SELECT mp.plan_id, r.recipe_id, CURRENT_DATE + x.d, x.slot
FROM (VALUES
 ('Aarav - this week','Paneer Capsicum Masala',0,'dinner'),
 ('Aarav - this week','Palak Paneer',1,'dinner'),
 ('Aarav - this week','Paneer Fried Rice',2,'lunch'),
 ('Meera - quick meals','Masala Omelette',0,'breakfast'),
 ('Meera - quick meals','Cheese Toast',1,'breakfast'),
 ('Meera - quick meals','Curd Rice',1,'lunch'),
 ('Rohan - protein week','Chicken Curry',0,'dinner'),
 ('Rohan - protein week','Egg Fried Rice',1,'lunch'),
 ('Rohan - protein week','Masala Omelette',2,'breakfast')
) AS x(pname, rtitle, d, slot)
JOIN meal_plan mp ON mp.plan_name = x.pname
JOIN recipe r ON r.title = x.rtitle;
