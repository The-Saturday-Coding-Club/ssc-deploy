// Run database migrations
// Usage: node run-migration.js

const db = require('../db');

async function runMigration() {
    console.log('Running migration: Add env_vars column to apps table...');

    try {
        await db.query(`
            ALTER TABLE apps ADD COLUMN IF NOT EXISTS env_vars JSONB DEFAULT '{}'
        `);
        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }

    process.exit(0);
}

runMigration();
