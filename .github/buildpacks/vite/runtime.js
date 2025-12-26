// Vite Runtime Wrapper for AWS Lambda
// Serves the built Vite app (dist folder) via Express

const express = require('express');
const serverless = require('serverless-http');
const path = require('path');

const app = express();

// Serve static files from dist folder
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - all routes serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Export serverless handler
module.exports.handler = serverless(app);
