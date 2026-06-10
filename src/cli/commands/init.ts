import { Command } from 'commander';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { ErrorHandler } from '../../utils/errorHandler.js';
import { logger } from '../../services/Logger.js';
import { GitService } from '../../services/GitService.js';
import { DatabaseService } from '../../database/DatabaseService.js';
import { ConfigService } from '../../services/ConfigService.js';
import { StorageService } from '../../services/StorageService.js';
import chalk from 'chalk';

export const initCommand = new Command('init')
  .description('Initialize a new DSA Vault workspace in the current directory')
  .action(async () => {
    try {
      const workspaceRoot = process.cwd();
      
      console.log(chalk.blue('Initializing DSA Vault workspace...'));
      
      // 1. Check if already initialized
      const configPath = path.join(workspaceRoot, 'config.json');
      if (existsSync(configPath)) {
        console.log(chalk.yellow('Workspace is already initialized in this directory.'));
        return;
      }

      // 2. Create directory structure
      const dirs = ['problems', 'reviews', 'templates', 'logs'];
      for (const dir of dirs) {
        await fs.mkdir(path.join(workspaceRoot, dir), { recursive: true });
      }
      console.log(chalk.green('✓ Created directory structure'));

      // 3. Initialize Logger
      await logger.initialize(workspaceRoot);
      logger.info('init', 'Initializing new workspace');

      // 4. Initialize Database
      const dbPath = path.join(workspaceRoot, 'reviews', 'dsa-vault.db');
      const db = new DatabaseService({ path: dbPath });
      // DatabaseService constructor automatically initializes schema
      db.close(); // Close it for now
      console.log(chalk.green('✓ Initialized SQLite database'));

      // 5. Initialize Git Repository
      const gitService = new GitService({ workspaceRoot });
      await gitService.init();
      console.log(chalk.green('✓ Initialized Git repository'));

      // 6. Create default config
      const configService = new ConfigService(workspaceRoot);
      await configService.initialize();
      console.log(chalk.green('✓ Created default config.json'));

      // 7. Create default notes template
      const templatePath = path.join(workspaceRoot, 'templates', 'notes-template.md');
      
      const rawTemplate = `# \${title}

**Platform:** \${platform}
**Difficulty:** \${difficulty}
**URL:** [\${url}](\${url})
**Tags:** \${tags}

## 📝 Problem Statement
> Describe the problem in your own words. What are the key constraints?

## 💡 Approach
> Explain the approach or algorithm you used.

## ⏱️ Complexity
- **Time Complexity:** O(?)
- **Space Complexity:** O(?)

## 🔑 Key Insight
> What was the "aha!" moment? What trick or pattern makes this problem solvable?

## ⚠️ Common Mistakes / Pitfalls
> What did you get wrong initially? What edge cases should you watch out for?

## 🔄 Follow-up
> How would the approach change if constraints were different? Are there similar problems?
`;

      await fs.writeFile(templatePath, rawTemplate, 'utf-8');

      console.log(chalk.green('✓ Created default notes template'));

      console.log(chalk.bold.green('\nDSA Vault initialized successfully! 🎉'));
      console.log('\nNext steps:');
      console.log('1. Review and update config.json if needed.');
      console.log('2. Ensure Chrome/Edge is running with remote debugging enabled.');
      console.log('   Example: chrome --remote-debugging-port=9222');
      console.log('3. Capture your first problem:');
      console.log('   dsa-vault capture');

    } catch (error) {
      ErrorHandler.handleErrorAndExit(error as Error);
    }
  });
