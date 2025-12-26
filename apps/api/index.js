const db = require('./db');
const { Octokit } = require('@octokit/rest');
const { encrypt, decrypt } = require('./crypto');

// Secret for deployment callbacks (set in Lambda environment)
const DEPLOYMENT_SECRET = process.env.DEPLOYMENT_SECRET;
if (!DEPLOYMENT_SECRET) {
    console.error('CRITICAL: DEPLOYMENT_SECRET environment variable is not set');
}

// GitHub repository configuration (REQUIRED - no defaults for open-source compatibility)
const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME;
if (!GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
    console.error('CRITICAL: GITHUB_REPO_OWNER and GITHUB_REPO_NAME environment variables must be set');
}

// CORS headers - restrict to specific origins in production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

function getCorsHeaders(event) {
    const origin = event?.headers?.origin || event?.headers?.Origin || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET, PATCH, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Deployment-Secret, X-Github-Token',
        'Access-Control-Allow-Credentials': 'true',
    };
}

// Authentication middleware - extracts and validates user
function authenticate(event) {
    // Get user ID from header (set by frontend after GitHub OAuth)
    const userId = event.headers?.['x-user-id'] || event.headers?.['X-User-Id'];

    if (!userId) {
        return { authenticated: false, error: 'Missing X-User-Id header' };
    }

    // Basic validation - user ID should be a non-empty string (GitHub user ID)
    if (typeof userId !== 'string' || userId.trim() === '') {
        return { authenticated: false, error: 'Invalid user ID' };
    }

    return { authenticated: true, userId: userId.trim() };
}

// Validate deployment callback secret
function validateDeploymentSecret(event) {
    const secret = event.headers?.['x-deployment-secret'] || event.headers?.['X-Deployment-Secret'];
    return secret === DEPLOYMENT_SECRET;
}

exports.handler = async (event) => {
    // Safe logging - exclude sensitive headers
    // API Gateway HTTP API v2 uses rawPath, v1 uses path
    const safeLog = {
        method: event.requestContext?.http?.method || event.httpMethod,
        path: event.rawPath || event.requestContext?.http?.path || event.path,
    };
    console.log('Request:', JSON.stringify(safeLog));

    const method = safeLog.method;
    const path = safeLog.path;
    const headers = getCorsHeaders(event);

    try {
        // CORS preflight
        if (method === 'OPTIONS') {
            return { statusCode: 204, headers };
        }

        // Health check - no auth required
        if (method === 'GET' && path === '/') {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Control Plane API is running!' }),
                headers
            };
        }

        // Deployment status update - requires deployment secret (from GitHub Actions)
        if (method === 'PATCH' && path.match(/\/deployments\/.*/)) {
            if (!validateDeploymentSecret(event)) {
                return {
                    statusCode: 401,
                    body: JSON.stringify({ message: 'Invalid deployment secret' }),
                    headers
                };
            }
            const deploymentId = path.split('/')[2];
            return await updateDeployment(deploymentId, event, headers);
        }

        // All other routes require user authentication
        const auth = authenticate(event);
        if (!auth.authenticated) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: auth.error }),
                headers
            };
        }

        const userId = auth.userId;

        // Route handling with authenticated user
        if (method === 'GET' && path === '/apps') {
            return await getApps(userId, headers);
        } else if (method === 'POST' && path === '/apps') {
            return await createApp(event, headers, userId);
        } else if (method === 'GET' && path.match(/^\/apps\/[^/]+$/) && !path.includes('/deploy')) {
            const appId = path.split('/')[2];
            return await getApp(appId, userId, headers);
        } else if (method === 'PATCH' && path.match(/^\/apps\/[^/]+$/) && !path.includes('/deploy')) {
            const appId = path.split('/')[2];
            return await updateApp(appId, event, headers, userId);
        } else if (method === 'DELETE' && path.match(/^\/apps\/[^/]+$/)) {
            const appId = path.split('/')[2];
            return await deleteApp(appId, userId, headers);
        } else if (method === 'POST' && path.match(/\/apps\/.*\/deploy/)) {
            const appId = path.split('/')[2];
            return await deployApp(appId, event, userId, headers);
        } else if (method === 'GET' && path.match(/\/deployments\/.*/)) {
            const deploymentId = path.split('/')[2];
            return await getDeployment(deploymentId, userId, headers);
        } else if (method === 'POST' && path === '/user/token') {
            // Store encrypted GitHub token for the user
            return await storeUserToken(event, userId, headers);
        } else if (method === 'DELETE' && path === '/user/token') {
            // Remove stored token
            return await deleteUserToken(userId, headers);
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Route not found' }),
                headers
            };
        }
    } catch (error) {
        console.error('Error:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error' }),
            headers
        };
    }
}

async function getApps(userId, headers) {
    // Only return apps belonging to the authenticated user
    const query = `
        SELECT a.*, d.status as last_status, d.url as last_url
        FROM apps a
        LEFT JOIN LATERAL (
            SELECT status, url
            FROM deployments
            WHERE app_id = a.id
            ORDER BY created_at DESC
            LIMIT 1
        ) d ON true
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
    `;

    const result = await db.query(query, [userId]);
    return {
        statusCode: 200,
        body: JSON.stringify(result.rows),
        headers
    };
}

async function getApp(appId, userId, headers) {
    try {
        // Only return app if it belongs to the authenticated user
        const query = `
            SELECT a.*, d.status as last_status, d.url as last_url
            FROM apps a
            LEFT JOIN LATERAL (
                SELECT status, url
                FROM deployments
                WHERE app_id = a.id
                ORDER BY created_at DESC
                LIMIT 1
            ) d ON true
            WHERE a.id = $1 AND a.user_id = $2
        `;
        const result = await db.query(query, [appId, userId]);

        if (result.rows.length === 0) {
            return { statusCode: 404, headers, body: JSON.stringify({ message: "App not found" }) };
        }
        return { statusCode: 200, headers, body: JSON.stringify(result.rows[0]) };
    } catch (e) {
        console.error("Error in getApp:", e.message);
        return { statusCode: 500, headers, body: JSON.stringify({ message: "Internal error" }) };
    }
}

async function createApp(event, headers, userId) {
    try {
        const body = JSON.parse(event.body);

        // Validate required fields
        if (!body.name || !body.repo_url) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Missing name or repo_url' }), headers };
        }

        // Validate repo_url format (owner/repo)
        const repoUrlPattern = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;
        if (!repoUrlPattern.test(body.repo_url)) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Invalid repo_url format. Use: owner/repo' }), headers };
        }

        // Validate branch name
        const branchPattern = /^[a-zA-Z0-9_.\/-]+$/;
        if (body.branch && !branchPattern.test(body.branch)) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Invalid branch name' }), headers };
        }

        // Validate env_vars if provided
        const envVars = body.env_vars || {};
        if (typeof envVars !== 'object' || Array.isArray(envVars)) {
            return { statusCode: 400, body: JSON.stringify({ message: 'env_vars must be an object' }), headers };
        }

        const result = await db.query(
            'INSERT INTO apps (name, repo_url, branch, user_id, env_vars) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, repo_url, branch, env_vars',
            [body.name, body.repo_url, body.branch || 'main', userId, JSON.stringify(envVars)]
        );

        return {
            statusCode: 201,
            body: JSON.stringify(result.rows[0]),
            headers
        };
    } catch (e) {
        console.error("Error in createApp:", e.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to create app" }),
            headers
        };
    }
}

async function updateApp(appId, event, headers, userId) {
    const body = JSON.parse(event.body);

    // Check if app exists AND belongs to user
    const appRes = await db.query('SELECT * FROM apps WHERE id = $1 AND user_id = $2', [appId, userId]);
    if (appRes.rows.length === 0) {
        return {
            statusCode: 404,
            body: JSON.stringify({ message: 'App not found' }),
            headers
        };
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (body.name) {
        updates.push(`name = $${paramIndex++}`);
        values.push(body.name);
    }
    if (body.repo_url) {
        updates.push(`repo_url = $${paramIndex++}`);
        values.push(body.repo_url);
    }
    if (body.branch) {
        updates.push(`branch = $${paramIndex++}`);
        values.push(body.branch);
    }
    if (body.env_vars !== undefined) {
        if (typeof body.env_vars !== 'object' || Array.isArray(body.env_vars)) {
            return { statusCode: 400, body: JSON.stringify({ message: 'env_vars must be an object' }), headers };
        }
        updates.push(`env_vars = $${paramIndex++}`);
        values.push(JSON.stringify(body.env_vars));
    }

    if (updates.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ message: 'No fields to update' }), headers };
    }

    values.push(appId);
    values.push(userId);
    const result = await db.query(
        `UPDATE apps SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex} RETURNING id, name, repo_url, branch, env_vars`,
        values
    );

    return {
        statusCode: 200,
        body: JSON.stringify(result.rows[0]),
        headers
    };
}

async function deleteApp(appId, userId, headers) {
    try {
        // First verify the app belongs to the user
        const appRes = await db.query('SELECT id FROM apps WHERE id = $1 AND user_id = $2', [appId, userId]);
        if (appRes.rows.length === 0) {
            return { statusCode: 404, headers, body: JSON.stringify({ message: "App not found" }) };
        }

        // Check if app has any successful deployments (AWS resources exist)
        const deployRes = await db.query(
            "SELECT id FROM deployments WHERE app_id = $1 AND status = 'SUCCESS' LIMIT 1",
            [appId]
        );
        const hasAwsResources = deployRes.rows.length > 0;

        // Trigger AWS resource cleanup if resources exist
        if (hasAwsResources && GITHUB_REPO_OWNER && GITHUB_REPO_NAME) {
            try {
                const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
                await octokit.actions.createWorkflowDispatch({
                    owner: GITHUB_REPO_OWNER,
                    repo: GITHUB_REPO_NAME,
                    workflow_id: 'destroy-user-app.yml',
                    ref: 'main',
                    inputs: {
                        app_id: appId
                    }
                });
                console.log(`Triggered destroy workflow for app ${appId}`);
            } catch (e) {
                console.error("Failed to trigger destroy workflow:", e.message);
                // Continue with DB deletion even if workflow trigger fails
                // AWS resources can be cleaned up manually later
            }
        }

        // Delete deployments first (foreign key constraint)
        await db.query('DELETE FROM deployments WHERE app_id = $1', [appId]);
        await db.query('DELETE FROM apps WHERE id = $1 AND user_id = $2', [appId, userId]);

        return { statusCode: 204, headers, body: '' };
    } catch (e) {
        console.error("Error in deleteApp:", e.message);
        return { statusCode: 500, headers, body: JSON.stringify({ message: "Internal error" }) };
    }
}

async function deployApp(appId, event, userId, headers) {
    // Only allow deploying apps that belong to the user
    const appRes = await db.query('SELECT * FROM apps WHERE id = $1 AND user_id = $2', [appId, userId]);
    if (appRes.rows.length === 0) {
        return {
            statusCode: 404,
            body: JSON.stringify({ message: 'App not found' }),
            headers
        };
    }
    const app = appRes.rows[0];

    // Retrieve stored encrypted token for the user
    let userToken = '';
    try {
        const userRes = await db.query(
            'SELECT encrypted_token FROM users WHERE github_id = $1',
            [userId]
        );
        if (userRes.rows.length > 0 && userRes.rows[0].encrypted_token) {
            userToken = decrypt(userRes.rows[0].encrypted_token);
        }
    } catch (e) {
        console.error("Failed to retrieve user token:", e.message);
        // Continue without token - public repos will still work
    }

    // Fallback to header token if no stored token (backwards compatibility)
    if (!userToken) {
        userToken = event.headers?.['x-github-token'] || event.headers?.['X-Github-Token'] || '';
    }

    const deployRes = await db.query(
        'INSERT INTO deployments (app_id, status) VALUES ($1, $2) RETURNING id, status',
        [appId, 'QUEUED']
    );
    const deployment = deployRes.rows[0];

    // Clean up old deployments - keep only the last 5 per app
    try {
        await db.query(`
            DELETE FROM deployments
            WHERE app_id = $1
            AND id NOT IN (
                SELECT id FROM deployments
                WHERE app_id = $1
                ORDER BY created_at DESC
                LIMIT 5
            )
        `, [appId]);
    } catch (e) {
        console.error("Failed to cleanup old deployments:", e.message);
        // Non-critical, continue with deployment
    }

    // Validate GitHub configuration
    if (!GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Server configuration error: GitHub repository not configured' }),
            headers
        };
    }

    try {
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        await octokit.actions.createWorkflowDispatch({
            owner: GITHUB_REPO_OWNER,
            repo: GITHUB_REPO_NAME,
            workflow_id: 'deploy-user-app.yml',
            ref: 'main',
            inputs: {
                app_id: app.id,
                repo_url: app.repo_url,
                branch: app.branch,
                deployment_id: deployment.id,
                env_vars: JSON.stringify(app.env_vars || {}),
                user_repo_token: userToken
            }
        });
    } catch (e) {
        console.error("Failed to trigger GitHub Action:", e.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to trigger deployment' }),
            headers
        };
    }

    return {
        statusCode: 202,
        body: JSON.stringify({
            message: 'Deployment queued',
            deployment_id: deployment.id
        }),
        headers
    };
}

async function getDeployment(deploymentId, userId, headers) {
    // Only return deployment if the associated app belongs to the user
    const result = await db.query(
        `SELECT d.* FROM deployments d
         JOIN apps a ON d.app_id = a.id
         WHERE d.id = $1 AND a.user_id = $2`,
        [deploymentId, userId]
    );
    if (result.rows.length === 0) {
        return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Deployment not found' }),
            headers
        };
    }
    return {
        statusCode: 200,
        body: JSON.stringify(result.rows[0]),
        headers
    };
}

// This function is called by GitHub Actions with deployment secret - no user auth needed
async function updateDeployment(deploymentId, event, headers) {
    const body = JSON.parse(event.body);
    const result = await db.query(
        'UPDATE deployments SET status = COALESCE($1, status), url = COALESCE($2, url), updated_at = NOW() WHERE id = $3 RETURNING *',
        [body.status, body.url, deploymentId]
    );

    if (result.rows.length === 0) {
        return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Deployment not found' }),
            headers
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify(result.rows[0]),
        headers
    };
}

// Store encrypted GitHub token for user
async function storeUserToken(event, userId, headers) {
    try {
        const body = JSON.parse(event.body);

        if (!body.token) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Missing token in request body' }),
                headers
            };
        }

        // Encrypt the token before storing
        const encryptedToken = encrypt(body.token);

        // Upsert user with encrypted token
        const result = await db.query(
            `INSERT INTO users (github_id, github_username, access_token, encrypted_token, token_updated_at)
             VALUES ($1, $2, '', $3, NOW())
             ON CONFLICT (github_id)
             DO UPDATE SET encrypted_token = $3, token_updated_at = NOW()
             RETURNING id, github_id`,
            [userId, body.username || 'unknown', encryptedToken]
        );

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Token stored securely',
                user_id: result.rows[0].id
            }),
            headers
        };
    } catch (e) {
        console.error("Error storing user token:", e.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to store token' }),
            headers
        };
    }
}

// Delete stored token for user
async function deleteUserToken(userId, headers) {
    try {
        await db.query(
            'UPDATE users SET encrypted_token = NULL, token_updated_at = NOW() WHERE github_id = $1',
            [userId]
        );

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Token removed' }),
            headers
        };
    } catch (e) {
        console.error("Error deleting user token:", e.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to delete token' }),
            headers
        };
    }
}
