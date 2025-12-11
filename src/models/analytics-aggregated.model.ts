import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalyticsAggregated extends Document {
    date: Date;
    totalEvents: number;
    eventTypes: Record<string, number>;
    uniqueUsers: number;
    createdAt: Date;
}

const analyticsAggregatedSchema = new Schema<IAnalyticsAggregated>({
    date: {
        type: Date,
        required: true,
        unique: true, // Should be unique per day
        index: true
    },
    totalEvents: {
        type: Number,
        required: true
    },
    eventTypes: {
        type: Map,
        of: Number,
        default: {}
    },
    uniqueUsers: {
        type: Number,
        required: true
    }
}, {
    timestamps: true,
    collection: 'analytics_aggregated'
});

export const AnalyticsAggregated = mongoose.model<IAnalyticsAggregated>('AnalyticsAggregated', analyticsAggregatedSchema);
