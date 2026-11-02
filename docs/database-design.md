# PantryPal database design

## Standard notation

The report uses **Chen notation** for the conceptual ER diagram: rectangles are entities, diamonds are relationships, ovals are attributes and primary keys are underlined. Selected attributes are shown to keep the conceptual view readable. `recipe_ingredient` is explicitly represented as the associative entity with a composite primary key.

Chen is the only ER diagram included in this repository. A parent can have zero or many children; each child has one parent except `recipe.created_by`, which can be null. The relation cardinalities are labeled in the diagram. The SQL schema and machine-readable schema model retain the complete column details.

- [Chen SVG](../PantryPal_Report_Assets/er-diagram.svg)
- [Chen PNG](../PantryPal_Report_Assets/er-diagram.png)
- [Editable Chen DOT source](../PantryPal_Report_Assets/er-diagram.dot)
- [Complete schema model](schema-model.json)

## Nine tables

Eight business tables are unchanged in purpose: app_user, ingredient, recipe, pantry_item, recipe_ingredient, rating, meal_plan and meal_plan_item. `app_session` adds authenticated browser sessions. It has session_id, user_id, token_hash, created_at and expires_at. Its user FK cascades on user deletion. Token hashes are unique and expiration must follow creation. Password hashes now use VARCHAR(255). An additional unique index on lower(email) prevents case-insensitive account duplicates.

Unique pairs are enforced on pantry_item(user_id, ingredient_id), rating(user_id, recipe_id), and the recipe_ingredient composite PK. Email and ingredient name are unique. Consult schema.sql for unique and compound constraints, defaults and CHECK expressions. SQL remains the implementation authority.

## Migration

For existing data, apply `pantrypal_code/migrations/001_auth.sql`. It widens the password column and adds session storage/indexes without dropping business tables. It can be reapplied. Pre-existing case-insensitive email duplicates must be resolved explicitly rather than silently merged. Original seeded accounts are disabled until `npm run setup:demo` provisions local salted hashes. The setup leaves existing scrypt hashes untouched.

## Reproducibility

`npm run diagrams` generates only the Chen diagram and complete schema model using `scripts/generate-er-diagrams.js`. Its explicit field model is checked against the PostgreSQL schema in the integration tests. Update this model whenever a migration changes columns or relationships.
