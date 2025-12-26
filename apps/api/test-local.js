const { handler } = require('./index');

async function runTest() {
    console.log('--- Testing POST /apps ---');
    const createEvent = {
        httpMethod: 'POST',
        path: '/apps',
        body: JSON.stringify({
            name: 'Local Test App ' + Date.now(),
            repo_url: 'Yasin1012/test-app',
            branch: 'main'
        })
    };
    const createRes = await handler(createEvent);
    console.log('Create Response:', createRes);
    const app = JSON.parse(createRes.body);

    if (createRes.statusCode === 201) {
        console.log('\n--- Testing POST /deploy ---');
        const deployEvent = {
            httpMethod: 'POST',
            path: `/apps/${app.id}/deploy`,
        };
        const deployRes = await handler(deployEvent);
        console.log('Deploy Response:', deployRes);
        const deploy = JSON.parse(deployRes.body);

        if (deployRes.statusCode === 202) {
            console.log('\n--- Testing GET /deployments ---');
            const getEvent = {
                httpMethod: 'GET',
                path: `/deployments/${deploy.deployment_id}`
            };
            const getRes = await handler(getEvent);
            console.log('Get Deployment Response:', getRes);
        }
    }
}

runTest();
