-- Migration: Add encrypted_token column to users table
-- Run this on your Neon PostgreSQL database

-- Add encrypted_token column (stores AES-256-GCM encrypted GitHub tokens)
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_token TEXT;

-- Add token_updated_at to track when token was last refreshed
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_updated_at TIMESTAMP DEFAULT NOW();

-- Create index for faster lookups by github_id
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);

-- Note: The old access_token column can be removed after migration is complete
-- and all tokens are encrypted. For safety, keep it during transition.
-- ALTER TABLE users DROP COLUMN access_token;
