import mongoose from 'mongoose';
import { createContextualLogger } from '../core/logger/logger.js';

const logger = createContextualLogger({ module: 'DatabaseIndexes' });

export async function createDatabaseIndexes(): Promise<void> {
    try {
        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not established');
        }

        logger.info('Creating database indexes...');

        // Conversations collection
        await db.collection('conversations').createIndexes([
            { key: { userId: 1, createdAt: -1 }, name: 'user_conversations_by_date' },
            { key: { userId: 1, updatedAt: -1 }, name: 'user_conversations_by_update' },
            { key: { conversationId: 1 }, name: 'conversation_id_lookup', unique: true },
        ]);
        logger.info('Created indexes for conversations collection');

        // ConversationMessages collection
        await db.collection('conversationmessages').createIndexes([
            { key: { conversationId: 1, timestamp: -1 }, name: 'conversation_messages_timeline' },
            { key: { userId: 1, timestamp: -1 }, name: 'user_messages_timeline' },
            { key: { generationId: 1 }, name: 'generation_id_lookup' },
        ]);
        logger.info('Created indexes for conversationmessages collection');

        // Sessions collection
        await db.collection('sessions').createIndexes([
            { key: { userId: 1, createdAt: -1 }, name: 'user_sessions_by_date' },
            { key: { conversationId: 1 }, name: 'session_conversation_lookup' },
            { key: { sessionId: 1 }, name: 'session_id_lookup', unique: true },
            {
                key: { createdAt: 1 },
                name: 'session_ttl',
                expireAfterSeconds: 30 * 24 * 60 * 60 // 30 days
            },
        ]);
        logger.info('Created indexes for sessions collection');

        // ConversationSummaries collection
        await db.collection('conversationsummaries').createIndexes([
            { key: { userId: 1, createdAt: -1 }, name: 'user_summaries_by_date' },
            { key: { conversationIds: 1 }, name: 'summary_conversation_lookup' },
        ]);
        logger.info('Created indexes for conversationsummaries collection');

        // Users collection
        await db.collection('users').createIndexes([
            { key: { email: 1 }, name: 'user_email_lookup', unique: true },
            { key: { userId: 1 }, name: 'user_id_lookup', unique: true },
        ]);
        logger.info('Created indexes for users collection');

        // Templates collection
        await db.collection('templates').createIndexes([
            { key: { userId: 1, createdAt: -1 }, name: 'user_templates_by_date' },
            { key: { isDefault: 1 }, name: 'default_templates_lookup' },
        ]);
        logger.info('Created indexes for templates collection');

        // Tools collection
        await db.collection('tools').createIndexes([
            { key: { name: 1 }, name: 'tool_name_lookup', unique: true },
            { key: { isEnabled: 1 }, name: 'enabled_tools_lookup' },
        ]);
        logger.info('Created indexes for tools collection');

        logger.info('✅ All database indexes created successfully');
    } catch (error: any) {
        logger.error('Failed to create database indexes', { error: error.message });
        throw error;
    }
}
