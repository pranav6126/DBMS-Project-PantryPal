# PantryPal database design

## Standard notation

The report uses **Chen notation** for the conceptual ER diagram: rectangles are entities, diamonds are relationships, ovals are attributes and primary keys are underlined. Selected attributes are shown to keep the conceptual view readable. `recipe_ingredient` is explicitly represented as the associative entity with a composite primary key.

The **Crow’s Foot diagram** is the complete logical model. It lists all nine tables, their columns and SQL types, primary keys (PK), foreign keys (FK) and unique fields (UK). A circle means zero, a bar means one and a crow’s foot means many. Solid lines identify relationships whose FK forms part of the child PK; other relationships are dashed. A parent can have zero or many children. Each child has one parent, except `recipe.created_by`, which can be null (zero or one creator).

- [Chen SVG](../PantryPal_Report_Assets/er-diagram.svg)
- [Chen PNG](../PantryPal_Report_Assets/er-diagram.png)
- [Crow’s Foot SVG](../PantryPal_Report_Assets/er-crows-foot.svg)
- [Crow’s Foot PNG](../PantryPal_Report_Assets/er-crows-foot.png)
- [Mermaid source](er-diagram.mmd)

## Nine tables

Eight business tables are unchanged in purpose: app_user, ingredient, recipe, pantry_item, recipe_ingredient, rating, meal_plan and meal_plan_item. `app_session` adds authenticated browser sessions. It has session_id, user_id, token_hash, created_at and expires_at. Its user FK cascades on user deletion. Token hashes are unique and expiration must follow creation. Password hashes now use VARCHAR(255). An additional unique index on lower(email) prevents case-insensitive account duplicates.

Unique pairs are enforced on pantry_item(user_id, ingredient_id), rating(user_id, recipe_id), and the recipe_ingredient composite PK. Email and ingredient name are unique. The diagrams mark single-column unique fields; consult schema.sql for compound constraints, defaults and CHECK expressions. SQL remains the implementation authority.

## Migration

For existing data, apply `pantrypal_code/migrations/001_auth.sql`. It widens the password column and adds session storage/indexes without dropping business tables. It can be reapplied. Pre-existing case-insensitive email duplicates must be resolved explicitly rather than silently merged. Original seeded accounts are disabled until `npm run setup:demo` provisions local salted hashes. The setup leaves existing scrypt hashes untouched.

## Reproducibility

`npm run diagrams` generates both notation variants and Mermaid source using `scripts/generate-er-diagrams.js`. Its explicit field model is checked against the PostgreSQL schema in the integration tests. Update this model whenever a migration changes columns or relationships.
