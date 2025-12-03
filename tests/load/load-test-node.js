import http from 'http';

// Configuration
const CONFIG = {
    baseUrl: 'http://localhost:3000/api',
    concurrentUsers: 100,
    totalRequests: 500, // 5 requests per user on average
    rampUpTime: 5000, // 5 seconds
};

// Stats
const stats = {
    successful: 0,
    failed: 0,
    latencies: [],
    startTime: Date.now(),
};

function makeRequest() {
    return new Promise((resolve) => {
        const start = Date.now();
        const req = http.request(`${CONFIG.baseUrl}/health`, { method: 'GET' }, (res) => {
            const duration = Date.now() - start;
            if (res.statusCode === 200) {
                stats.successful++;
                stats.latencies.push(duration);
            } else {
                stats.failed++;
            }
            res.resume(); // Consume response to free memory
            resolve();
        });

        req.on('error', () => {
            stats.failed++;
            resolve();
        });

        req.end();
    });
}

async function runLoadTest() {
    console.log(`🚀 Starting Node.js Load Test`);
    console.log(`   Target: ${CONFIG.baseUrl}`);
    console.log(`   Concurrent Users: ${CONFIG.concurrentUsers}`);
    console.log(`   Total Requests: ${CONFIG.totalRequests}`);
    console.log('----------------------------------------');

    const promises = [];
    for (let i = 0; i < CONFIG.totalRequests; i++) {
        // Add some jitter/ramp-up
        await new Promise(r => setTimeout(r, Math.random() * CONFIG.rampUpTime / 10));
        promises.push(makeRequest());
        
        if (promises.length >= CONFIG.concurrentUsers) {
            // Wait for a batch to complete to maintain concurrency roughly
            await Promise.race(promises);
        }
    }

    await Promise.all(promises);

    const endTime = Date.now();
    const duration = (endTime - stats.startTime) / 1000;
    
    // Calculate stats
    const avgLatency = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length || 0;
    const sortedLatencies = stats.latencies.sort((a, b) => a - b);
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;

    console.log('\n📊 Load Test Results');
    console.log('----------------------------------------');
    console.log(`Total Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Requests: ${stats.successful + stats.failed}`);
    console.log(`Successful:     ${stats.successful} ✅`);
    console.log(`Failed:         ${stats.failed} ❌`);
    console.log(`Success Rate:   ${((stats.successful / (stats.successful + stats.failed)) * 100).toFixed(1)}%`);
    console.log('----------------------------------------');
    console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`p95 Latency:     ${p95.toFixed(2)}ms`);
    console.log('----------------------------------------');

    if (stats.failed > 0 || p95 > 500) {
        console.log('⚠️  Performance targets NOT met (p95 < 500ms, 0 errors)');
        process.exit(1);
    } else {
        console.log('✅ Performance targets MET');
        process.exit(0);
    }
}

runLoadTest();
