
import { Injectable, LoggerService as NestLoggerService, LogLevel } from '@nestjs/common';

/**
 * Interface for structured log data.
 */
interface LogData {
    level: LogLevel;
    message: string;
    timestamp: string; // ISO string format
    context?: string; // NestJS context
    [key: string]: any; // Allow additional structured data
}

@Injectable()
export class LoggingService implements NestLoggerService {

    /**
     * Logs a message with structured data.
     * Integrates with external logging service or uses console.
     */
    private async logToServer(logData: LogData): Promise<void> {
        // Basic console logging for now
        const { level, timestamp, message, context, ...meta } = logData;
        const contextStr = context ? `[${context}] ` : '';

        switch (logData.level) {
            case 'error':
                console.error(`[Nest] ${process.pid} - ${timestamp} [${level.toUpperCase()}] ${contextStr}${message}`, meta, logData.errorStack || '');
                break;
            case 'warn':
                console.warn(`[Nest] ${process.pid} - ${timestamp} [${level.toUpperCase()}] ${contextStr}${message}`, meta);
                break;
            case 'log':
                console.log(`[Nest] ${process.pid} - ${timestamp} [${level.toUpperCase()}] ${contextStr}${message}`, meta);
                break;
            case 'debug':
                console.debug(`[Nest] ${process.pid} - ${timestamp} [${level.toUpperCase()}] ${contextStr}${message}`, meta);
                break;
            case 'verbose':
                console.debug(`[Nest] ${process.pid} - ${timestamp} [${level.toUpperCase()}] ${contextStr}${message}`, meta); // Map verbose to debug for simplicity
                break;
            default:
                console.log(`[Nest] ${process.pid} - ${timestamp} [LOG] ${contextStr}${message}`, meta);
        }

        // Placeholder for sending logs to an external service
        // try { ... } catch { ... }
    }

    log(message: any, context?: string, ...meta: any[]) {
       this.logToServer({
            level: 'log',
            message: typeof message === 'string' ? message : JSON.stringify(message),
            timestamp: new Date().toISOString(),
            context,
            ...this.buildMeta(meta),
       });
    }

    error(message: any, trace?: string, context?: string, ...meta: any[]) {
        const errorMessage = message instanceof Error ? message.message : (typeof message === 'string' ? message : JSON.stringify(message));
        const errorStack = message instanceof Error ? message.stack : trace;
        this.logToServer({
            level: 'error',
            message: errorMessage,
            timestamp: new Date().toISOString(),
            errorStack,
            context,
            errorName: message instanceof Error ? message.name : undefined,
            ...this.buildMeta(meta),
        });
    }

    warn(message: any, context?: string, ...meta: any[]) {
         this.logToServer({
             level: 'warn',
             message: typeof message === 'string' ? message : JSON.stringify(message),
             timestamp: new Date().toISOString(),
             context,
             ...this.buildMeta(meta),
         });
    }

    debug?(message: any, context?: string, ...meta: any[]) {
        this.logToServer({
            level: 'debug',
            message: typeof message === 'string' ? message : JSON.stringify(message),
            timestamp: new Date().toISOString(),
            context,
            ...this.buildMeta(meta),
        });
    }

    verbose?(message: any, context?: string, ...meta: any[]) {
         this.logToServer({
             level: 'verbose', // Internally maps to console.debug
             message: typeof message === 'string' ? message : JSON.stringify(message),
             timestamp: new Date().toISOString(),
             context,
             ...this.buildMeta(meta),
         });
    }

    // Helper to merge meta arrays/objects
    private buildMeta(meta: any[]): Record<string, any> {
        const result: Record<string, any> = {};
        meta.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
                Object.assign(result, item);
            } else {
                result[`meta_${index}`] = item;
            }
        });
        return result;
    }
}
