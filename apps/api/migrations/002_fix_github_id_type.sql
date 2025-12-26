-- Migration: Fix github_id type from INTEGER to VARCHAR
-- The github_id from NextAuth comes as a string, and can be larger than INTEGER max

-- Change github_id from INTEGER to VARCHAR to match NextAuth token.sub
ALTER TABLE users ALTER COLUMN github_id TYPE VARCHAR(255) USING github_id::text;

-- Verify the apps.user_id is also VARCHAR (should be done by migrate-auth.js)
-- This is idempotent
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps'
        AND column_name = 'user_id'
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE apps DROP CONSTRAINT IF EXISTS apps_user_id_fkey;
        ALTER TABLE apps ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::text;
    END IF;
END $$;
