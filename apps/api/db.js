const { Pool } = require('pg');

// If running locally without Lambda env, load .env (simplified for this exercise)
// In production, process.env.DATABASE_URL is provided by AWS Lambda config
if (!process.env.DATABASE_URL) {
    // Very basic .env parser for local dev if not using dotenv package
    const fs = require('fs');
    const path = require('path');
    try {
        const envPath = path.resolve(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const data = fs.readFileSync(envPath, 'utf8');
            data.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    process.env[key.trim()] = value.trim().replace(/"/g, '');
                }
            });
        }
    } catch (e) {
        console.log('No .env file found or error reading it');
    }
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Neon
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
