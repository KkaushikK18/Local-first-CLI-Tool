import { Command } from 'commander';
import { DatabaseService } from '../../database/DatabaseService.js';
import { ConfigService } from '../../services/ConfigService.js';
import { BrowserService } from '../../services/BrowserService.js';
import { StorageService } from '../../services/StorageService.js';
import { CaptureEngine } from '../../services/CaptureEngine.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

export const importCommand = new Command('import')
  .description('Batch import problems from a list of URLs')
  .argument('<file>', 'Path to a text file containing one URL per line')
  .action(async (file: string) => {
    try {
      const workspaceRoot = process.cwd();
      const filePath = path.resolve(workspaceRoot, file);

      if (!existsSync(filePath)) {
        console.log(chalk.red(`File not found: ${filePath}`));
        return;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const urls = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && line.startsWith('http'));

      if (urls.length === 0) {
        console.log(chalk.yellow('No valid URLs found in the file.'));
        return;
      }

      console.log(chalk.blue(`Found ${urls.length} URLs to import.`));

      const configService = new ConfigService(workspaceRoot);
      const config = await configService.get();

      const dbPath = path.join(workspaceRoot, 'reviews', 'dsa-vault.db');
      const db = new DatabaseService({ path: dbPath });

      const browserService = new BrowserService(config.browser);
      const storageService = new StorageService({ workspaceRoot }, db);
      const captureEngine = new CaptureEngine(browserService, storageService, db);

      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i] as string;
        console.log(chalk.cyan(`\n[${i + 1}/${urls.length}] Importing: ${url}`));
        
        try {
          // Check if already exists to save time
          const existing = db.findProblemByUrl(url);
          if (existing) {
            console.log(chalk.yellow(`  Already exists in vault. Skipping.`));
            continue;
          }

          const editorCmd = config.editor.command || process.env.EDITOR || 'vim';
          const savedPath = await captureEngine.captureFromUrl(url, editorCmd);
          console.log(chalk.green(`  ✓ Successfully imported to: ${savedPath}`));
          successCount++;
        } catch (error: any) {
          console.log(chalk.red(`  ✗ Failed to import: ${error.message}`));
          failureCount++;
        }
      }

      console.log(chalk.bold.magenta('\n=== Import Summary ==='));
      console.log(`Total URLs: ${urls.length}`);
      console.log(`Successful: ${chalk.green(successCount)}`);
      console.log(`Failed/Skipped: ${chalk.red(urls.length - successCount)}`);

      db.close();

    } catch (error) {
      ErrorHandler.handleErrorAndExit(error as Error);
    }
  });
