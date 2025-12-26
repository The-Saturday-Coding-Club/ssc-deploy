const db = require('./db');

async function migrate() {
    try {
        console.log("Adding env_vars column to apps table...");
        await db.query(`
            ALTER TABLE apps 
            ADD COLUMN IF NOT EXISTS env_vars JSONB DEFAULT '{}'::jsonb;
        `);
        console.log("Migration successful: env_vars column added.");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        process.exit();
    }
}

migrate();
