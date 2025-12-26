const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Connection Failed:', err);
        process.exit(1);
    } else {
        console.log('Connection Success:', res.rows[0]);
        process.exit(0);
    }
});
