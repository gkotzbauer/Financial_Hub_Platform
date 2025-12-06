/**
 * Logger utility for the chat agent system
 * Provides structured logging with different levels and contexts
 */

import winston from 'winston';
import path from 'path';

export class Logger {
  constructor(context = 'ChatAgent') {
    this.context = context;
    this.logger = this.createLogger();
  }

  createLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const ctx = context || this.context;
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level.toUpperCase()}] [${ctx}] ${message}${metaStr}`;
      })
    );

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            logFormat
          )
        }),

        // File transport for all logs
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'chat-agent.log'),
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }),

        // Error-only file transport
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'error.log'),
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ]
    });
  }

  debug(message, meta = {}) {
    this.logger.debug(message, { context: this.context, ...meta });
  }

  info(message, meta = {}) {
    this.logger.info(message, { context: this.context, ...meta });
  }

  warn(message, meta = {}) {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  error(message, meta = {}) {
    if (meta instanceof Error) {
      this.logger.error(message, {
        context: this.context,
        error: meta.message,
        stack: meta.stack
      });
    } else {
      this.logger.error(message, { context: this.context, ...meta });
    }
  }

  // Create child logger with additional context
  child(additionalContext) {
    const childContext = `${this.context}:${additionalContext}`;
    return new Logger(childContext);
  }
}

export default Logger;