-- Additive upgrade for existing installations. Does not reset pantry/recipe data.
BEGIN;
ALTER TABLE app_user ALTER COLUMN password_hash TYPE VARCHAR(255);
-- Abort rather than silently merge pre-existing case-insensitive email duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_lower ON app_user (lower(email));
CREATE TABLE IF NOT EXISTS app_session (
    session_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_session_user ON app_session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_expiry ON app_session(expires_at);
COMMIT;
