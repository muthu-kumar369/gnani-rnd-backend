// STAGE 1: Backend message validation helper
import ConversationMessage from '../memory/entities/conversation.entity.js';
import { createContextualLogger } from '../../core/logger/logger.js';

const logger = createContextualLogger({ module: 'MessageValidator' });

/**
 * Validate parentId exists before creating a message
 * STAGE 1: Prevent broken message chains at database level
 */
export async function validateParentId(
    parentId: string | undefined,
    conversationId: string
): Promise<void> {
    if (!parentId) {
        // Root message - no parent required
        return;
    }

    // Check if parent exists
    const parent = await ConversationMessage.findOne({
        _id: parentId,
        conversationId,
        deletedAt: null
    });

    if (!parent) {
        logger.error('Invalid parentId - parent message not found', {
            parentId,
            conversationId
        });
        throw new Error(`Invalid parentId: ${parentId}. Parent message does not exist.`);
    }

    logger.debug('ParentId validated successfully', { parentId, conversationId });
}

/**
 * Validate message before creation
 */
export async function validateMessage(messageData: {
    parentId?: string;
    parentMessageId?: string;
    conversationId: string;
    role: string;
    content: string;
}): Promise<void> {
    // Validate parentId or parentMessageId
    const parentId = messageData.parentId || messageData.parentMessageId;
    if (parentId) {
        await validateParentId(parentId, messageData.conversationId);
    }

    // Validate content is not empty
    if (!messageData.content || messageData.content.trim().length === 0) {
        throw new Error('Message content cannot be empty');
    }

    // Validate role
    const validRoles = ['user', 'assistant', 'system'];
    if (!validRoles.includes(messageData.role)) {
        throw new Error(`Invalid role: ${messageData.role}. Must be one of: ${validRoles.join(', ')}`);
    }
}
