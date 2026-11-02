# PantryPal DBMS Project

Personal pantry management and expiry-aware recipe recommendations with email/password authentication.

**Team:** Pranav V Menon (PES1UG24AM198) and Purvik V Gowda (PES1UG24AM211), PES University, CSE (AI & ML).

## Report and standard ER diagrams

- [DBMS project report](PantryPal_DBMS_Project_Report.md)
- [Chen ER diagram](PantryPal_Report_Assets/er-diagram.svg): rectangles, relationship diamonds, attribute ovals and underlined primary keys.
- [Crow’s Foot ER diagram](PantryPal_Report_Assets/er-crows-foot.svg): all nine tables and columns, PK/FK/UK markers, optionality and cardinality.
- [Diagram notation and schema details](docs/database-design.md)

## Stack

HTML, CSS and plain JavaScript; Node.js and Express; PostgreSQL and optional MongoDB. This is an Express application, not Next.js.

## Existing installation upgrade — preserves project data

From this project root, with PostgreSQL running:

```bash
npm install
psql -d pantrypal -v ON_ERROR_STOP=1 -f pantrypal_code/migrations/001_auth.sql
npm run setup:demo
npm start
```

Stop the previous `node server.js` process with Ctrl+C in its Terminal before starting the updated server on port 3000. Open [PantryPal](http://localhost:3000). Unauthenticated users are redirected to the sign-in page.

`setup:demo` only enables the four original demo accounts whose password hashes have not yet been provisioned. It generates a random local password and saves the emails/password to **DEMO_LOGIN.local.txt** in the project root. This file is ignored by Git. Do not upload it. Running the command again does not reset existing hashed passwords. Never publish real passwords in source code or screenshots.

Alternatively, choose **Create account** to register your own email, password and diet preference. Registration creates a default weekly plan. Add ingredients and purchase dates in **My pantry**, then open **Cook tonight**. To compare Aarav and Meera during the presentation, sign out and sign in to the other account; there is no account-switching shortcut.

## Fresh database setup — destructive reset

Only for a new database or an intentional reset. `schema.sql` drops the existing project tables.

```bash
createdb pantrypal
psql -d pantrypal -v ON_ERROR_STOP=1 -f pantrypal_code/schema.sql
psql -d pantrypal -v ON_ERROR_STOP=1 -f pantrypal_code/seed.sql
npm install
npm run setup:demo
npm start
```

The schema contains eight business tables plus `app_session`. The seed file contains disabled password markers, not plaintext or working public credentials. `npm run setup:demo` provisions password hashes locally. To choose a demo password yourself, set `DEMO_PASSWORD` locally when running that command; keep it out of Git and public screenshots.

## Authentication and privacy

- Registration and sign-in verify salted scrypt password hashes using Node’s built-in crypto module.
- An opaque random session token is sent only in an HttpOnly, SameSite=Strict cookie. PostgreSQL stores its SHA-256 hash and an eight-hour expiration.
- Logout deletes the database session. All data API routes require a valid, non-expired session.
- Personal user IDs come from the verified session, never a request-selected user ID.
- Users can read and update their own pantry and add meals to their own plan. Recipe summaries are shared; personal SQL report rows and MongoDB documents are scoped to the signed-in user. Admin accounts can view all report activity.
- JSON mutation checks reject cross-origin browser requests; sign-in and registration have a simple in-process rate limit.
- For HTTPS production hosting, set `NODE_ENV=production` so cookies carry Secure. This local classroom app has no password-reset/email-verification workflow or distributed rate limiter.

## Optional MongoDB

Start your local MongoDB service. From the project root:

```bash
# Initialization/reset only — drops and reseeds the two MongoDB collections:
mongosh --file pantrypal_code/mongo_setup.js
# Six command-line reports:
mongosh --file pantrypal_code/mongo_reports.js
```

The web tab shows M1–M3. Ranking requests save search logs; adding a meal marks the latest unclicked search. If MongoDB is unavailable, core PostgreSQL features still work. `MONGO_URL` defaults to `mongodb://127.0.0.1:27017` and `MONGO_DATABASE` defaults to `pantrypal_nosql`.

## Tests and diagram regeneration

```bash
npm test
npm run diagrams
```

Tests create and remove a dedicated temporary PostgreSQL database and use a separate temporary MongoDB database. The database user needs CREATEDB permission. Tests cover password hashing, registration, duplicate emails, login, authorization, cross-origin writes, pantry ownership, planning/trigger behavior, report scoping, logout and session expiry. The demo database is not reset by the tests. `PGTEST_ADMIN_DATABASE` defaults to `postgres`.

Diagram generation uses the development dependencies `@viz-js/viz` and `sharp` to create editable SVG/DOT, PNG and Mermaid files. See [database design](docs/database-design.md). The full model includes nullable recipe creators and the session relationship.

## Configuration

`PGDATABASE` defaults to `pantrypal`; standard `PGUSER`, `PGPASSWORD`, `PGHOST` and `PGPORT` configure PostgreSQL. `PORT` defaults to 3000. Set environment variables locally; no `.env` loader is installed. Use a different development port if required, for example `PORT=3001 npm start`.

## Database and implementation notes

`times_cooked` is the existing database field name, but the UI labels it **planned** because its trigger counts meal-plan insertions. Expired ingredients are excluded from both ranking and the missing-ingredient presence check. Quantity remains descriptive text; sufficient amounts are not calculated. Existing user screenshots are retained in the report as historical evidence and distinguished from current authentication screenshots.

Official references: [Node.js crypto](https://nodejs.org/api/crypto.html), [Express cookie security](https://expressjs.com/en/advanced/best-practice-security/).
