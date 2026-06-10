import { Command } from 'commander';
import { DatabaseService } from '../../database/DatabaseService.js';
import { ConfigService } from '../../services/ConfigService.js';
import { BrowserService } from '../../services/BrowserService.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import simpleGit from 'simple-git';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

export const doctorCommand = new Command('doctor')
  .description('Check the health of your DSA Vault')
  .action(async () => {
    try {
      const workspaceRoot = process.cwd();
      console.log(chalk.bold.magenta('\n=== DSA Vault Doctor ===\n'));

      let hasErrors = false;

      // 1. Config Check
      console.log(chalk.bold.cyan('1. Configuration Check'));
      const configService = new ConfigService(workspaceRoot);
      const configExists = await configService.exists();
      if (configExists) {
        try {
          await configService.get();
          console.log(chalk.green('  ✓ config.json is valid'));
        } catch (e: any) {
          console.log(chalk.red(`  ✗ config.json has errors: ${e.message}`));
          hasErrors = true;
        }
      } else {
        console.log(chalk.yellow('  ! config.json not found (will use defaults)'));
      }

      // 2. Database Check
      console.log(chalk.bold.cyan('\n2. Database Check'));
      const dbPath = path.join(workspaceRoot, 'reviews', 'dsa-vault.db');
      let db: DatabaseService | null = null;
      if (existsSync(dbPath)) {
        try {
          db = new DatabaseService({ path: dbPath });
          const stats = db.getStats();
          console.log(chalk.green('  ✓ Database connection successful'));
          console.log(`  ✓ Found ${stats.totalProblems} problems and ${stats.dueCount} due for review`);
        } catch (e: any) {
          console.log(chalk.red(`  ✗ Database connection failed: ${e.message}`));
          hasErrors = true;
        }
      } else {
        console.log(chalk.red('  ✗ Database file not found'));
        hasErrors = true;
      }

      // 3. File System Integrity
      console.log(chalk.bold.cyan('\n3. File System Integrity'));
      if (db) {
        try {
          const problems = db.getProblems();
          let missingFiles = 0;
          for (const p of problems) {
            if (!existsSync(p.file_path)) {
              missingFiles++;
            }
          }
          if (missingFiles === 0) {
            console.log(chalk.green('  ✓ All problem directories exist'));
          } else {
            console.log(chalk.red(`  ✗ ${missingFiles} problem directories are missing!`));
            hasErrors = true;
          }
        } catch (e: any) {
          console.log(chalk.red(`  ✗ Failed to verify file system: ${e.message}`));
          hasErrors = true;
        }
      } else {
        console.log(chalk.gray('  - Skipped (Database not available)'));
      }

      // 4. Git Check
      console.log(chalk.bold.cyan('\n4. Git Repository Check'));
      try {
        const git = simpleGit(workspaceRoot);
        const isRepo = await git.checkIsRepo();
        if (isRepo) {
          console.log(chalk.green('  ✓ Git repository initialized'));
          const status = await git.status();
          if (status.isClean()) {
            console.log(chalk.green('  ✓ Working tree clean'));
          } else {
            console.log(chalk.yellow(`  ! Working tree has ${status.files.length} uncommitted changes`));
          }
        } else {
          console.log(chalk.yellow('  ! Not a Git repository'));
        }
      } catch (e: any) {
        console.log(chalk.red(`  ✗ Git check failed: ${e.message}`));
      }

      // 5. Browser Connection Check
      console.log(chalk.bold.cyan('\n5. Browser Automation Check'));
      try {
        const config = await configService.get();
        const browserService = new BrowserService(config.browser);
        console.log(chalk.gray(`  Attempting to connect to Chrome at ${config.browser.cdpUrl}...`));
        const browser = await browserService.connect();
        console.log(chalk.green('  ✓ Successfully connected to running Chrome instance'));
        await browser.close();
      } catch (e: any) {
        console.log(chalk.yellow('  ! Browser connection failed.'));
        console.log(chalk.gray(`    Reason: ${e.message}`));
        console.log(chalk.gray('    Note: This is normal if Chrome is not currently running with --remote-debugging-port=9222'));
      }

      console.log('\n');
      if (hasErrors) {
        console.log(chalk.red.bold('Diagnosis: There are errors that need your attention.'));
      } else {
        console.log(chalk.green.bold('Diagnosis: Your DSA Vault is healthy! 🚀'));
      }
      
      if (db) db.close();
    } catch (error) {
      ErrorHandler.handleErrorAndExit(error as Error);
    }
  });
