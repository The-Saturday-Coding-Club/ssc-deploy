const db = require('./db');

async function migrate() {
    try {
        console.log("Starting migration...");

        // 1. Drop Foreign Key Constraint (if exists)
        // We catch error in case it doesn't exist or has different name, manual check might be better but this is MVP
        try {
            await db.query(`ALTER TABLE apps DROP CONSTRAINT IF EXISTS apps_user_id_fkey`);
            console.log("Dropped FK constraint");
        } catch (e) {
            console.log("FK drop skipped/failed", e.message);
        }

        // 2. Alter Column Type to VARCHAR (TEXT)
        // We cast existing UUIDs to text
        await db.query(`ALTER TABLE apps ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::text`);
        console.log("Altered user_id column to VARCHAR");

        console.log("Migration done.");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

migrate();
