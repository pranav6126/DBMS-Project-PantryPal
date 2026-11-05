# Authentication and ER diagram update

- Added sign-in, registration, persistent PostgreSQL sessions, logout, salted scrypt hashes and cookie-based authorization.
- Added an additive migration and local-only demo password provisioning; the seed script no longer pretends placeholder values are valid password hashes.
- Replaced the UI user selector with signed-in identity and sign-out. Personal API requests derive ownership from the session. Registration creates an initial plan, and a pantry form lets new users add ingredients.
- Scoped private SQL/MongoDB report rows by account; admins can see all activity. Rejected cross-origin JSON mutations and added a local sign-in/register attempt limit.
- Kept the existing eight business entities and added app_session as the ninth table. Replaced the original diagram with a standard Chen diagram, plus editable sources.
- Split browser code/styles into app.js and styles.css; added auth.html/auth.js. Updated the project report, schema, setup, README and API descriptions.
- Changed the UI label from cooked to planned and excluded expired rows from missing-ingredient checks to match ranking behavior.
- Added integration tests using isolated databases. Historical screenshots remain explicitly identified; the team-supplied current sign-in screenshot is included separately.

The existing Express architecture remains; no Next.js migration is claimed.

## Screenshot and presentation cleanup

- Removed the four agent-captured screenshots and replaced them with the team-supplied sign-in image.
- Retained only the Chen ER diagram; removed the table-style alternative and its generator output.
- Added prominent localhost links to the README and report.

## Local application address

- Standardized the server default, README links and report examples on http://localhost:3001.

## Team-supplied ER diagram

- Replaced the generated Chen image with the team-supplied diagram, without altering the image.
- Removed obsolete generated SVG/DOT files and replaced the generator with an image verification script so the approved image cannot be overwritten.
- Updated the README and report to map the five conceptual entities and three many-to-many relationships to the business tables. Documented the difference between the conceptual weak key and current SQL primary key; no database migration is applied by this image replacement.
