
const Redis = require('ioredis');

const testConnection = async (host) => {
    console.log(`Testing connection to ${host}:6379...`);
    const redis = new Redis({
        host: host,
        port: 6379,
        connectTimeout: 2000,
        lazyConnect: true
    });

    try {
        await redis.connect();
        console.log(`✅ Success: Connected to ${host}`);
        await redis.quit();
    } catch (error) {
        console.log(`❌ Failed: Could not connect to ${host}. Error: ${error.message}`);
    }
};

(async () => {
    await testConnection('localhost');
    await testConnection('127.0.0.1');
})();
