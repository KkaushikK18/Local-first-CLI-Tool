import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  operation: string;
  message: string;
  context?: Record<string, unknown>;
}

export class Logger {
  private static instance: Logger;
  private logPath: string | null = null;
  private minLevel: LogLevel = LogLevel.INFO;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 18.2 Implement structured logging system
   */
  async initialize(workspaceRoot: string, level: LogLevel = LogLevel.INFO) {
    this.minLevel = level;
    const logDir = path.join(workspaceRoot, 'logs');
    
    if (!existsSync(logDir)) {
      try {
        await fs.mkdir(logDir, { recursive: true });
      } catch (err) {
        // Can't log error to file if file creation fails, just use console
        console.error(chalk.red('Failed to create logs directory'), err);
      }
    }
    
    this.logPath = path.join(logDir, 'dsa-vault.log');
  }

  private async writeLog(level: LogLevel, operation: string, message: string, context?: Record<string, unknown>) {
    if (level < this.minLevel) return;

    const levelStr = LogLevel[level];
    const timestamp = new Date().toISOString();
    
    const entry: LogEntry = {
      timestamp,
      level: levelStr,
      operation,
      message,
    };
    
    if (context) {
      entry.context = context;
    }

    const logLine = JSON.stringify(entry) + '\n';

    // File logging
    if (this.logPath) {
      try {
        await fs.appendFile(this.logPath, logLine, 'utf-8');
      } catch (error) {
        console.error(chalk.red('Failed to write to log file'), error);
      }
    }

    // Console output mapping
    const consoleMsg = `[${timestamp}] [${levelStr}] [${operation}] ${message}`;
    switch (level) {
      case LogLevel.DEBUG:
        console.log(chalk.gray(consoleMsg));
        break;
      case LogLevel.INFO:
        console.log(chalk.blue(consoleMsg));
        break;
      case LogLevel.WARN:
        console.warn(chalk.yellow(consoleMsg));
        break;
      case LogLevel.ERROR:
        console.error(chalk.red(consoleMsg));
        if (context?.error) {
          console.error(chalk.red(context.error));
        }
        break;
    }
  }

  debug(operation: string, message: string, context?: Record<string, unknown>) {
    return this.writeLog(LogLevel.DEBUG, operation, message, context);
  }

  info(operation: string, message: string, context?: Record<string, unknown>) {
    return this.writeLog(LogLevel.INFO, operation, message, context);
  }

  warn(operation: string, message: string, context?: Record<string, unknown>) {
    return this.writeLog(LogLevel.WARN, operation, message, context);
  }

  error(operation: string, message: string, context?: Record<string, unknown>) {
    return this.writeLog(LogLevel.ERROR, operation, message, context);
  }
}

export const logger = Logger.getInstance();
