-- Execute this on your Neon PostgreSQL database
-- Note: Run migrations in apps/api/migrations/ after initial setup

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id VARCHAR(255) UNIQUE NOT NULL,  -- GitHub user ID from OAuth
  github_username VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL DEFAULT '',   -- Legacy field, kept for compatibility
  encrypted_token TEXT,                    -- AES-256-GCM encrypted GitHub token
  token_updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,  -- GitHub user ID (direct reference, not FK)
  name VARCHAR(255) NOT NULL,
  repo_url VARCHAR(500) NOT NULL,
  branch VARCHAR(255) DEFAULT 'main',
  env_vars JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL, -- QUEUED, BUILDING, SUCCESS, FAILED
  url VARCHAR(500),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_apps_user_id ON apps(user_id);
