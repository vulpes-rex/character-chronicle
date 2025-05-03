
'use server';

import type { LogLevel } from '@nestjs/common'; // Keep type for compatibility if needed

/**
 * Server-side logging service.
 * This version logs directly to the console or could be adapted to call a logging API endpoint.
 */

/**
 * Logs a message with a specified level and optional metadata.
 * @param level - The log level (e.g., 'log', 'error', 'warn', 'debug').
 * @param message - The message string or object to log.
 * @param meta - Additional metadata object.
 * @param context - Optional context string (e.g., service name).
 */
export async function logMessage(
    level: LogLevel | 'info', // Allow 'info' alias
    message: string | object,
    meta?: Record<string, any>,
    context?: string
): Promise<void> {
    const msg = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}] ` : '';
    const levelStr = level.toUpperCase();

    // Basic console logging implementation
    try {
        switch (level) {
            case 'error':
                console.error(`[${timestamp}] [ERROR] ${contextStr}${msg}`, meta ?? '');
                break;
            case 'warn':
                console.warn(`[${timestamp}] [WARN] ${contextStr}${msg}`, meta ?? '');
                break;
            case 'debug':
            case 'verbose': // Treat verbose as debug
                console.debug(`[${timestamp}] [DEBUG] ${contextStr}${msg}`, meta ?? '');
                break;
            case 'log':
            case 'info': // Treat info as log
            default:
                console.log(`[${timestamp}] [INFO] ${contextStr}${msg}`, meta ?? '');
                break;
        }
         // TODO: Optionally send log to a dedicated logging API endpoint
         // Example: await fetch('/api/log', { method: 'POST', body: JSON.stringify({ level, message: msg, meta, context, timestamp }) });
    } catch (e) {
        // Fallback in case console logging itself throws an error
        console.error("Internal logging error:", e);
        console.log(`[Fallback Log - ${levelStr}] ${contextStr}${msg}`, meta ?? '');
    }
}

/**
 * Logs an error object with optional context and metadata.
 * @param error - The error object.
 * @param meta - Additional metadata object, can include a custom message.
 * @param context - Optional context string.
 */
export async function logError(
    error: unknown,
    meta?: Record<string, any> & { message?: string },
    context?: string
): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));
    const customMessage = meta?.message;
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}] ` : '';

    try {
        console.error(`[${timestamp}] [ERROR] ${contextStr}${customMessage || err.message}`, {
            ...(meta ?? {}),
            errorName: err.name,
            stack: err.stack,
        });
        // TODO: Optionally send error to a dedicated logging API endpoint
        // Example: await fetch('/api/log', { method: 'POST', body: JSON.stringify({ level: 'error', message: customMessage || err.message, meta: { ...(meta ?? {}), errorName: err.name }, stack: err.stack, context, timestamp }) });
    } catch (e) {
        // Fallback
        console.error("Internal logging error (logError):", e);
        console.error(`[Fallback Error] ${contextStr}${customMessage || err.message}`, err.stack, meta ?? '');
    }
}
