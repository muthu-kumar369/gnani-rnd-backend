// scripts/node/verify_mongodb_setup.js
const mongoose = require('mongoose');
const logger = require('../../src/utils/logger');
const connectDB = require('../../src/config/db');
const User = require('../../src/models/User'); // Import the User model

async function verifyMongoDBSettings() {
    try {
        await connectDB(); // Establish connection to MongoDB

        logger.info('MongoDB connection verified successfully.');

        // Test User model insertion
        const testUsername = `testuser_${Date.now()}`;
        const testEmail = `test_${Date.now()}@example.com`;
        const testPasswordHash = 'hashedpassword123'; // In a real scenario, this would be a bcrypt hash

        // Check if a user with this username already exists to avoid unique constraint errors during repeated tests
        let existingUser = await User.findOne({ username: testUsername });
        if (existingUser) {
            logger.warn(`Test user ${testUsername} already exists. Deleting...`);
            await User.deleteOne({ username: testUsername });
            logger.warn(`Test user ${testUsername} deleted.`);
        }
        
        const newUser = new User({
            username: testUsername,
            email: testEmail,
            passwordHash: testPasswordHash,
            profile: { firstName: 'Test', lastName: 'User' },
            settings: { theme: 'light' },
        });

        const savedUser = await newUser.save();
        logger.info(`Test user inserted successfully: ${savedUser.username} (${savedUser.userId})`);

        // Test retrieval
        const foundUser = await User.findOne({ username: testUsername });
        if (foundUser) {
            logger.info(`Test user retrieved successfully: ${foundUser.username}`);
        } else {
            logger.error(`Failed to retrieve test user: ${testUsername}`);
        }

        // Test update
        foundUser.settings.theme = 'dark';
        await foundUser.save();
        logger.info(`Test user settings updated successfully.`);

        // Test deletion
        await User.deleteOne({ _id: foundUser._id });
        logger.info(`Test user deleted successfully.`);

    } catch (error) {
        logger.error(`MongoDB setup verification failed: ${error.message}`);
        process.exit(1);
    } finally {
        // Disconnect from MongoDB
        await mongoose.disconnect();
        logger.info('MongoDB disconnected.');
    }
}

// Ensure the script is executable
if (require.main === module) {
    verifyMongoDBSettings();
}
