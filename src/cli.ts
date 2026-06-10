#!/usr/bin/env node

import { program } from './cli/index.js';
import { ErrorHandler } from './utils/errorHandler.js';

// Global error handler for unhandled rejections
process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error) {
    ErrorHandler.handleErrorAndExit(reason);
  } else {
    console.error('Unhandled Rejection:', reason);
    process.exit(1);
  }
});

// Run CLI
program.parseAsync(process.argv).catch((error) => {
  ErrorHandler.handleErrorAndExit(error);
});
