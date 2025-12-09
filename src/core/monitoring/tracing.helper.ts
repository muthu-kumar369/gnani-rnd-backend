import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';

const tracer = trace.getTracer('gnani-backend', '1.0.0');

/**
 * Trace an async operation with automatic span management
 */
export async function traceAsyncOperation<T>(
    spanName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, any>
): Promise<T> {
    return tracer.startActiveSpan(spanName, async (span) => {
        try {
            if (attributes) {
                span.setAttributes(attributes);
            }
            const result = await operation();
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error) {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    });
}

/**
 * Trace a synchronous operation
 */
export function traceSyncOperation<T>(
    spanName: string,
    operation: () => T,
    attributes?: Record<string, any>
): T {
    return tracer.startActiveSpan(spanName, (span) => {
        try {
            if (attributes) {
                span.setAttributes(attributes);
            }
            const result = operation();
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error) {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    });
}

/**
 * Add event to current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, any>): void {
    const span = trace.getActiveSpan();
    if (span) {
        span.addEvent(name, attributes);
    }
}

/**
 * Set attribute on current span
 */
export function setSpanAttribute(key: string, value: any): void {
    const span = trace.getActiveSpan();
    if (span) {
        span.setAttribute(key, value);
    }
}

/**
 * Get current trace ID for logging correlation
 */
export function getCurrentTraceId(): string | undefined {
    const span = trace.getActiveSpan();
    if (span) {
        const spanContext = span.spanContext();
        return spanContext.traceId;
    }
    return undefined;
}

/**
 * Get current span ID for logging correlation
 */
export function getCurrentSpanId(): string | undefined {
    const span = trace.getActiveSpan();
    if (span) {
        const spanContext = span.spanContext();
        return spanContext.spanId;
    }
    return undefined;
}

/**
 * Create a child span manually
 */
export function startSpan(name: string, attributes?: Record<string, any>): Span {
    const span = tracer.startSpan(name);
    if (attributes) {
        span.setAttributes(attributes);
    }
    return span;
}

/**
 * Trace decorator for class methods (TypeScript)
 */
export function Trace(spanName?: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const name = spanName || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = async function (...args: any[]) {
            return traceAsyncOperation(
                name,
                () => originalMethod.apply(this, args),
                {
                    'method.name': propertyKey,
                    'class.name': target.constructor.name,
                }
            );
        };

        return descriptor;
    };
}
