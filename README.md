# PantryPal DBMS Project

Recipe recommendations using pantry availability and ingredient expiry.

**Team:** Pranav V Menon (PES1UG24AM198) and Purvik V Gowda (PES1UG24AM211), PES University, CSE (AI & ML).

## Project report

[Read the DBMS project report](PantryPal_DBMS_Project_Report.md), including the ER diagram, screenshots and 11 database feature use cases.

## Stack

HTML, CSS and JavaScript; Node.js and Express; PostgreSQL and MongoDB. The current implementation uses Express.


## One-time setup (database)
From the folder with the .sql files (`pantrypal_code`):

    createdb pantrypal
    psql -d pantrypal -f schema.sql
    psql -d pantrypal -f seed.sql

## Run the app
Install Node.js from nodejs.org if you do not have it, then in THIS folder:

    npm install
    node server.js

Open http://localhost:3000

## Optional: MongoDB
Start MongoDB and run `mongosh --file mongo_setup.js` once (from pantrypal_code).
Refresh the app: the "MongoDB reports" tab fills in, and every "Cook tonight"
search is saved to `search_logs`. Without MongoDB the rest of the app still works.

## If PostgreSQL asks for a user or password
    PGUSER=postgres PGPASSWORD=yourpassword node server.js
