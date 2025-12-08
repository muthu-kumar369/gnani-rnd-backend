import mongoose from 'mongoose';
import redisClient from '../src/config/redis.config.js';

beforeAll(async () => {
    // Connect to test database
    const testMongoUri = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/gnani-test';
    await mongoose.connect(testMongoUri);
    console.log('Test database connected');
});

afterAll(async () => {
    // Cleanup
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await redisClient.quit();
    console.log('Test cleanup complete');
});

afterEach(async () => {
    // Clear collections after each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }

    // Clear Redis
    await redisClient.flushdb();
});
