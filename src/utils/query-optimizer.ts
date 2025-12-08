// src/utils/query-optimizer.ts
// Stage 7: Query optimization utilities
import { createContextualLogger } from '../core/logger/logger.js';

const logger = createContextualLogger({ module: 'QueryOptimizer' });

/**
 * Optimize query by using lean() for read-only operations
 */
export function optimizeReadQuery<T>(query: any): any {
    return query.lean();
}

/**
 * Paginate query results efficiently
 */
export interface PaginationOptions {
    page: number;
    limit: number;
    sort?: Record<string, 1 | -1>;
}

export async function paginateQuery<T>(
    model: any,
    filter: any,
    options: PaginationOptions
): Promise<{ data: T[]; total: number; page: number; pages: number }> {
    const { page = 1, limit = 50, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;

    // Execute count and find in parallel
    const [total, data] = await Promise.all([
        model.countDocuments(filter),
        model.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean()
    ]);

    return {
        data,
        total,
        page,
        pages: Math.ceil(total / limit)
    };
}

/**
 * Batch operations for better performance
 */
export async function batchInsert<T>(
    model: any,
    documents: T[],
    batchSize: number = 1000
): Promise<void> {
    for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await model.insertMany(batch, { ordered: false });
        logger.debug(`Inserted batch ${i / batchSize + 1}`, {
            size: batch.length
        });
    }
}

/**
 * Efficient aggregation with cursor
 */
export async function aggregateWithCursor<T>(
    model: any,
    pipeline: any[],
    processor: (doc: T) => Promise<void>
): Promise<void> {
    const cursor = model.aggregate(pipeline).cursor();

    for await (const doc of cursor) {
        await processor(doc);
    }
}
