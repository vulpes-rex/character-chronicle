
'use server';

import { AppContainer } from '@/nestjs/app-container';
import { LoggingService as NestLoggingService } from '@/nestjs/logging/logging.service';
import type { LogLevel } from '@nestjs/common';

/**
 * Server-side logging service that leverages the NestJS LoggingService.
 * Ensures logs are handled consistently, whether originating from Server Actions
 * or within the NestJS application context.
 */

let loggingServiceInstance: NestLoggingService | null = null;
let initPromise: Promise<void> | null = null;

async function initializeLoggingService(): Promise<void> {
    if (loggingServiceInstance) {
        return;
    }
    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        try {
            const container = await AppContainer.getInstance();
            loggingServiceInstance = container.get(NestLoggingService);
            console.log("Server-side logging service initialized.");
        } catch (error) {
            console.error("Failed to initialize server-side logging service:", error);
            // Fallback to console logging if NestJS service fails
            loggingServiceInstance = {
                log: console.log,
                error: console.error,
                warn: console.warn,
                debug: console.debug,
                verbose: console.log,
                setContext: () => {}, // No-op
            } as any; // Cast needed for fallback
        } finally {
            initPromise = null; // Reset promise after completion/error
        }
    })();
    await initPromise;
}

/**
 * Logs a message with a specified level and optional metadata.
 * @param level - The log level (e.g., 'log', 'error', 'warn', 'debug').
 * @param message - The message string or object to log.
 * @param meta - Additional metadata object.
 * @param context - Optional context string (e.g., service name).
 */
export async function logMessage(
    level: LogLevel,
    message: string | object,
    meta?: Record<string, any>,
    context?: string
): Promise<void> {
    await initializeLoggingService(); // Ensure service is initialized
    const msg = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
    try {
        switch (level) {
            case 'error':
                loggingServiceInstance?.error(msg, undefined, context, meta); // Pass meta as additional arg
                break;
            case 'warn':
                loggingServiceInstance?.warn(msg, context, meta);
                break;
            case 'debug':
                loggingServiceInstance?.debug?.(msg, context, meta);
                break;
            case 'verbose':
                 loggingServiceInstance?.verbose?.(msg, context, meta);
                 break;
            case 'log':
            default:
                loggingServiceInstance?.log(msg, context, meta);
                break;
        }
    } catch (e) {
        // Fallback in case the logger itself throws an error
        console.error("Error in logging service:", e);
        console.log(`[Fallback Log - ${level.toUpperCase()}] ${context ? '['+context+'] ' : ''}${msg}`, meta ?? '');
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
    await initializeLoggingService(); // Ensure service is initialized
    const err = error instanceof Error ? error : new Error(String(error));
    const customMessage = meta?.message;

    try {
        loggingServiceInstance?.error(customMessage || err.message, err.stack, context, meta);
    } catch (e) {
        // Fallback in case the logger itself throws an error
        console.error("Error in logging service (logError):", e);
        console.error(`[Fallback Error] ${context ? '['+context+'] ' : ''}${customMessage || err.message}`, err.stack, meta ?? '');
    }
}
