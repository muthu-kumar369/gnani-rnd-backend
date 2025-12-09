import { MongoClient } from 'mongodb';

/**
 * Database Optimization Script
 * Creates indexes and optimizes MongoDB collections
 */

async function optimizeDatabase() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnani';
    const client = await MongoClient.connect(uri);

    try {
        const db = client.db();
        console.log('Connected to MongoDB, creating indexes...\n');

        // Conversations collection
        console.log('Optimizing conversations collection...');
        await db.collection('conversations').createIndexes([
            { key: { userId: 1, createdAt: -1 }, name: 'user_created' },
            { key: { userId: 1, updatedAt: -1 }, name: 'user_updated' },
            { key: { 'messages.createdAt': -1 }, name: 'messages_created' },
            { key: { status: 1 }, name: 'status' },
        ]);
        console.log('✓ Conversations indexes created');

        // Sessions collection
        console.log('\nOptimizing sessions collection...');
        await db.collection('sessions').createIndexes([
            { key: { userId: 1, status: 1 }, name: 'user_status' },
            { key: { conversationId: 1 }, name: 'conversation' },
            { key: { createdAt: -1 }, name: 'created' },
            { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: 'ttl' }, // TTL index
        ]);
        console.log('✓ Sessions indexes created (including TTL)');

        // Memory collection
        console.log('\nOptimizing memories collection...');
        await db.collection('memories').createIndexes([
            { key: { userId: 1, importance: -1 }, name: 'user_importance' },
            { key: { conversationId: 1 }, name: 'conversation' },
            { key: { createdAt: -1 }, name: 'created' },
            { key: { type: 1 }, name: 'type' },
        ]);
        console.log('✓ Memories indexes created');

        // Users collection
        console.log('\nOptimizing users collection...');
        await db.collection('users').createIndexes([
            { key: { email: 1 }, unique: true, name: 'email_unique' },
            { key: { 'oauth.provider': 1, 'oauth.providerId': 1 }, name: 'oauth' },
            { key: { createdAt: -1 }, name: 'created' },
        ]);
        console.log('✓ Users indexes created');

        // Embeddings collection (for vector search)
        console.log('\nOptimizing embeddings collection...');
        await db.collection('embeddings').createIndexes([
            { key: { userId: 1 }, name: 'user' },
            { key: { conversationId: 1 }, name: 'conversation' },
            { key: { createdAt: -1 }, name: 'created' },
        ]);
        console.log('✓ Embeddings indexes created');

        // Audit logs collection
        console.log('\nOptimizing audit_logs collection...');
        await db.collection('audit_logs').createIndexes([
            { key: { userId: 1, timestamp: -1 }, name: 'user_timestamp' },
            { key: { event: 1 }, name: 'event' },
            { key: { timestamp: -1 }, name: 'timestamp' },
            { key: { createdAt: 1 }, expireAfterSeconds: 2592000, name: 'ttl_30days' }, // 30 days TTL
        ]);
        console.log('✓ Audit logs indexes created (including TTL)');

        // Get index information
        console.log('\n' + '='.repeat(60));
        console.log('INDEX SUMMARY');
        console.log('='.repeat(60));

        const collections = ['conversations', 'sessions', 'memories', 'users', 'embeddings', 'audit_logs'];

        for (const collectionName of collections) {
            const indexes = await db.collection(collectionName).indexes();
            console.log(`\n${collectionName}: ${indexes.length} indexes`);
            indexes.forEach(index => {
                const keys = Object.keys(index.key).join(', ');
                console.log(`  - ${index.name}: ${keys}`);
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log('Database optimization complete!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Error optimizing database:', error);
        process.exit(1);
    } finally {
        await client.close();
    }
}

// Run optimization
if (require.main === module) {
    optimizeDatabase()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

export { optimizeDatabase };
