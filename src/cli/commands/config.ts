import { Command } from 'commander';
import { ConfigService } from '../../services/ConfigService.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import chalk from 'chalk';

export const configCommand = new Command('config')
  .description('Manage DSA Vault configuration')
  .addCommand(
    new Command('get')
      .description('Get a configuration value')
      .argument('<key>', 'Configuration key (e.g., git.autoPush, editor.command)')
      .action(async (key: string) => {
        try {
          const workspaceRoot = process.cwd();
          const configService = new ConfigService(workspaceRoot);
          const config = await configService.get();

          const keys = key.split('.');
          let value: any = config;
          for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
              value = value[k];
            } else {
              value = undefined;
              break;
            }
          }

          if (value !== undefined) {
            console.log(value);
          } else {
            console.log(chalk.yellow(`Configuration key '${key}' not found.`));
          }
        } catch (error) {
          ErrorHandler.handleErrorAndExit(error as Error);
        }
      })
  )
  .addCommand(
    new Command('set')
      .description('Set a configuration value')
      .argument('<key>', 'Configuration key (e.g., git.autoPush)')
      .argument('<value>', 'Configuration value')
      .action(async (key: string, value: string) => {
        try {
          const workspaceRoot = process.cwd();
          const configService = new ConfigService(workspaceRoot);
          
          let parsedValue: any = value;
          if (value.toLowerCase() === 'true') parsedValue = true;
          else if (value.toLowerCase() === 'false') parsedValue = false;
          else if (!isNaN(Number(value))) parsedValue = Number(value);

          await configService.set(key, parsedValue);
          console.log(chalk.green(`✓ Set ${key} to ${value}`));
        } catch (error) {
          ErrorHandler.handleErrorAndExit(error as Error);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List all configurations')
      .action(async () => {
        try {
          const workspaceRoot = process.cwd();
          const configService = new ConfigService(workspaceRoot);
          const config = await configService.get();
          console.log(JSON.stringify(config, null, 2));
        } catch (error) {
          ErrorHandler.handleErrorAndExit(error as Error);
        }
      })
  );
