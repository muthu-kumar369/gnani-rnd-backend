// migrations/001_add_message_lifecycle_fields.js
// MongoDB Migration Script for Message Lifecycle Features
// Run with: node migrations/001_add_message_lifecycle_fields.js

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnani';
const DB_NAME = 'gnani';
const COLLECTION_NAME = 'conversation_messages';

async function migrate() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);
        
        // Step 1: Add new fields to existing messages
        console.log('\n📝 Step 1: Adding new fields to existing messages...');
        const updateResult = await collection.updateMany(
            {
                // Only update messages that don't have the new fields
                status: { $exists: false }
            },
            {
                $set: {
                    // Lifecycle status
                    status: 'completed',
                    
                    // Soft delete fields
                    deletedAt: null,
                    deletedBy: null,
                    deletionReason: null,
                    
                    // Generation tracking
                    generationIndex: 0,
                    generationId: null, // Will be set by pre-save hook
                    parentMessageId: null,
                    
                    // Versioning
                    version: 1,
                    editHistory: [],
                    
                    // Stream state (null for existing messages)
                    streamState: null
                }
            }
        );
        console.log(`   ✅ Updated ${updateResult.modifiedCount} messages`);
        
        // Step 2: Generate generationId for existing messages
        console.log('\n📝 Step 2: Generating generationId for existing messages...');
        const messagesWithoutGenId = await collection.find({
            generationId: null
        }).toArray();
        
        let genIdCount = 0;
        for (const msg of messagesWithoutGenId) {
            const baseId = msg.parentMessageId || msg._id;
            const generationId = `gen_${baseId}_${msg.generationIndex || 0}`;
            
            await collection.updateOne(
                { _id: msg._id },
                { $set: { generationId } }
            );
            genIdCount++;
        }
        console.log(`   ✅ Generated ${genIdCount} generationIds`);
        
        // Step 3: Create new indexes
        console.log('\n📝 Step 3: Creating new indexes...');
        
        const indexes = [
            {
                name: 'session_deleted_timestamp',
                spec: { sessionId: 1, deletedAt: 1, timestamp: 1 }
            },
            {
                name: 'parent_generation_index',
                spec: { parentMessageId: 1, generationIndex: 1 }
            },
            {
                name: 'stream_id',
                spec: { 'streamState.streamId': 1 },
                options: { sparse: true }
            },
            {
                name: 'status_deleted',
                spec: { status: 1, deletedAt: 1 }
            },
            {
                name: 'generation_id',
                spec: { generationId: 1 },
                options: { unique: true, sparse: true }
            }
        ];
        
        for (const index of indexes) {
            try {
                await collection.createIndex(
                    index.spec,
                    { 
                        name: index.name,
                        background: true,
                        ...index.options 
                    }
                );
                console.log(`   ✅ Created index: ${index.name}`);
            } catch (error) {
                if (error.code === 85 || error.code === 86) {
                    console.log(`   ⚠️  Index ${index.name} already exists, skipping`);
                } else {
                    throw error;
                }
            }
        }
        
        // Step 4: Verify migration
        console.log('\n📝 Step 4: Verifying migration...');
        const totalMessages = await collection.countDocuments();
        const messagesWithStatus = await collection.countDocuments({ status: { $exists: true } });
        const messagesWithGenId = await collection.countDocuments({ generationId: { $ne: null } });
        
        console.log(`   Total messages: ${totalMessages}`);
        console.log(`   Messages with status: ${messagesWithStatus}`);
        console.log(`   Messages with generationId: ${messagesWithGenId}`);
        
        if (messagesWithStatus === totalMessages && messagesWithGenId === totalMessages) {
            console.log('   ✅ Migration verified successfully!');
        } else {
            console.log('   ⚠️  Some messages may not have been updated');
        }
        
        // Step 5: Show sample document
        console.log('\n📝 Step 5: Sample migrated document:');
        const sample = await collection.findOne({});
        console.log(JSON.stringify({
            _id: sample._id,
            role: sample.role,
            status: sample.status,
            generationIndex: sample.generationIndex,
            generationId: sample.generationId,
            version: sample.version,
            deletedAt: sample.deletedAt
        }, null, 2));
        
        console.log('\n✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run migration
migrate().catch(console.error);
