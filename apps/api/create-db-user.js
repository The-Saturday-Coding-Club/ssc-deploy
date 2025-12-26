const db = require('./db');

async function createDummyUser() {
    try {
        console.log('Creating dummy user...');
        const result = await db.query(
            "INSERT INTO users (github_id, github_username, access_token) VALUES ($1, $2, $3) ON CONFLICT (github_id) DO UPDATE SET github_username = EXCLUDED.github_username RETURNING id",
            [12345, 'testuser', 'dummy-token']
        );
        console.log('User ID:', result.rows[0].id);
        process.exit(0);
    } catch (error) {
        console.error('Error creating user:', error);
        process.exit(1);
    }
}

createDummyUser();
