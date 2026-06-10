import { Command } from 'commander';
import { GitService } from '../../services/GitService.js';
import { ConfigService } from '../../services/ConfigService.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import chalk from 'chalk';
import path from 'path';

export const syncCommand = new Command('sync')
  .description('Sync your vault with the remote Git repository')
  .option('-m, --message <message>', 'Custom commit message')
  .action(async (options) => {
    try {
      const workspaceRoot = process.cwd();
      const configService = new ConfigService(workspaceRoot);
      const config = await configService.get();

      console.log(chalk.blue('Syncing DSA Vault...'));

      const gitService = new GitService({
        workspaceRoot,
        autoPush: config.git.autoPush
      });

      const commitHash = await gitService.sync(options.message);

      if (commitHash) {
        console.log(chalk.green(`✓ Successfully synced (Commit: ${commitHash.substring(0, 7)})`));
      } else {
        console.log(chalk.yellow('No changes to sync. Vault is up to date.'));
      }
    } catch (error) {
      ErrorHandler.handleErrorAndExit(error as Error);
    }
  });
