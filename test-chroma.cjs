
const http = require('http');

const testChroma = (host) => {
    console.log(`Testing connection to ChromaDB at ${host}:8000...`);
    const options = {
        hostname: host,
        port: 8000,
        path: '/api/v1/heartbeat',
        method: 'GET',
        timeout: 2000
    };

    const req = http.request(options, (res) => {
        console.log(`✅ Success: Connected to ${host} (Status: ${res.statusCode})`);
    });

    req.on('error', (e) => {
        console.log(`❌ Failed: Could not connect to ${host}. Error: ${e.message}`);
    });

    req.on('timeout', () => {
        req.destroy();
        console.log(`❌ Failed: Connection to ${host} timed out`);
    });

    req.end();
};

testChroma('172.28.240.1');
