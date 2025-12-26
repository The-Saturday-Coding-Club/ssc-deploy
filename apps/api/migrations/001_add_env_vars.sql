-- Migration: Add env_vars column to apps table
-- Run this against your Neon database

-- Add env_vars column as JSONB to store key-value pairs
ALTER TABLE apps ADD COLUMN IF NOT EXISTS env_vars JSONB DEFAULT '{}';

-- Example usage:
-- INSERT INTO apps (name, repo_url, branch, user_id, env_vars)
-- VALUES ('my-app', 'owner/repo', 'main', 'user-uuid', '{"API_KEY": "xxx", "DEBUG": "true"}');
