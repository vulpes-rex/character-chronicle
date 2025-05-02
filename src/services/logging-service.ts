
'use server';

/**
 * Interface for structured log data.
 */
interface LogData {
    level: 'error' | 'warn' | 'info' | 'debug';
    message: string;
    timestamp: string; // ISO string format
    [key: string]: any; // Allow additional structured data
}

/**
 * Logs a message with structured data.
 * In a real application, this would integrate with a dedicated logging service
 * (e.g., Sentry, LogRocket, Google Cloud Logging, Datadog).
 *
 * @param logData - The structured data to log.
 */
async function logToServer(logData: LogData): Promise<void> {
    // Basic console logging for now
    switch (logData.level) {
        case 'error':
            console.error(`[${logData.timestamp}] [${logData.level.toUpperCase()}] ${logData.message}`, logData);
            break;
        case 'warn':
            console.warn(`[${logData.timestamp}] [${logData.level.toUpperCase()}] ${logData.message}`, logData);
            break;
        case 'info':
            console.info(`[${logData.timestamp}] [${logData.level.toUpperCase()}] ${logData.message}`, logData);
            break;
        case 'debug':
            console.debug(`[${logData.timestamp}] [${logData.level.toUpperCase()}] ${logData.message}`, logData);
            break;
        default:
            console.log(`[${logData.timestamp}] [LOG] ${logData.message}`, logData);
    }

    // Placeholder for sending logs to an external service
    // try {
    //   const response = await fetch('https://your-logging-service.com/api/log', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(logData),
    //   });
    //   if (!response.ok) {
    //     console.error("Failed to send log to external service:", response.statusText);
    //   }
    // } catch (error) {
    //   console.error("Error sending log to external service:", error);
    // }
}

/**
 * Logs an error object with additional context.
 *
 * @param error - The error object to log.
 * @param context - Optional additional context (e.g., request details, user info).
 */
export async function logError(error: Error, context: Record<string, any> = {}): Promise<void> {
    const logData: LogData = {
        level: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
        errorName: error.name,
        errorStack: error.stack,
        ...context,
    };
    await logToServer(logData);
}

/**
 * Logs a generic message with a specified level and context.
 *
 * @param level - The severity level of the log.
 * @param message - The log message.
 * @param context - Optional additional context.
 */
export async function logMessage(level: LogData['level'], message: string, context: Record<string, any> = {}): Promise<void> {
    const logData: LogData = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...context,
    };
    await logToServer(logData);
}
