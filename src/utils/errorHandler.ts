import { DSAVaultError, isValidationError, isExtractionError, isAuthenticationError, isDatabaseError, isFileSystemError, isGitError, isBrowserError, isDuplicateError, isConfigurationError, isNotFoundError } from '../types/index.js';
import chalk from 'chalk';

export class ErrorHandler {
  static formatError(error: Error | DSAVaultError): string {
    if (!('_tag' in error)) {
      return chalk.red(`[Error] ${error.message}\n`) + chalk.gray(error.stack || '');
    }

    let output = chalk.red.bold(`[${error._tag}] `) + chalk.red(error.message) + '\n';

    if (isValidationError(error)) {
      output += chalk.yellow('\nValidation Issues:\n');
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        output += `  - ${chalk.bold(field)}: ${messages.join(', ')}\n`;
      }
      output += chalk.cyan('\nRecovery: Please correct the invalid data and try again.');
    } else if (isExtractionError(error)) {
      output += chalk.yellow(`\nPlatform: ${error.platform}\n`);
      output += `Missing fields: ${error.missingFields.join(', ')}\n`;
      output += chalk.cyan('\nRecovery: The page structure might have changed. Try updating DSA Vault or use manual extraction.');
    } else if (isAuthenticationError(error)) {
      output += chalk.yellow(`\nPlatform: ${error.platform}\n`);
      output += chalk.cyan(`\nRecovery: Please log into ${error.platform} in your browser and try again.`);
    } else if (isDatabaseError(error)) {
      output += chalk.yellow(`\nOperation: ${error.operation}\n`);
      if (error.cause) output += chalk.gray(`Cause: ${error.cause.message}\n`);
      output += chalk.cyan('\nRecovery: Check database permissions or try running the doctor command.');
    } else if (isFileSystemError(error)) {
      output += chalk.yellow(`\nOperation: ${error.operation}\nPath: ${error.path}\n`);
      if (error.cause) output += chalk.gray(`Cause: ${error.cause.message}\n`);
      output += chalk.cyan('\nRecovery: Verify file permissions and disk space.');
    } else if (isGitError(error)) {
      output += chalk.yellow(`\nOperation: ${error.operation}\n`);
      if (error.cause) output += chalk.gray(`Cause: ${error.cause.message}\n`);
      output += chalk.cyan('\nRecovery: Check your git configuration or remote connection.');
    } else if (isBrowserError(error)) {
      output += chalk.yellow(`\nOperation: ${error.operation}\n`);
      if (error.cause) output += chalk.gray(`Cause: ${error.cause.message}\n`);
      if (error.operation === 'connect') {
        output += chalk.cyan('\nRecovery: Make sure you have launched your browser with --remote-debugging-port=9222');
      }
    } else if (isDuplicateError(error)) {
      output += chalk.yellow(`\nURL: ${error.url}\n`);
      output += chalk.cyan('\nRecovery: Use resolution options like --overwrite or --merge.');
    } else if (isConfigurationError(error)) {
      output += chalk.yellow(`\nKey: ${error.configKey}\n`);
      output += chalk.cyan('\nRecovery: Check your config.json file and correct the invalid setting.');
    } else if (isNotFoundError(error)) {
      output += chalk.yellow(`\nResource: ${error.resourceType} (${error.identifier})\n`);
    }

    return output;
  }

  static handleErrorAndExit(error: Error | DSAVaultError): never {
    console.error(this.formatError(error));
    process.exit(1);
  }
}
