import { Command } from 'commander';
import { DatabaseService } from '../../database/DatabaseService.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import chalk from 'chalk';
import path from 'path';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

export const searchCommand = new Command('search')
  .description('Search your problem vault')
  .argument('<query>', 'Search query string')
  .action(async (query: string) => {
    const workspaceRoot = process.cwd();
    
    try {
      const dbPath = path.join(workspaceRoot, 'reviews', 'dsa-vault.db');
      const db = new DatabaseService({ path: dbPath });

      // Search across title, topic, tags
      const queryLower = query.toLowerCase();
      
      const problems = db.getProblems({}).filter(p => {
        let parsedTags: string[] = [];
        try {
          parsedTags = JSON.parse(p.tags);
        } catch {
          // ignore
        }
        return p.title.toLowerCase().includes(queryLower) ||
               p.topic.toLowerCase().includes(queryLower) ||
               parsedTags.some(t => t.toLowerCase().includes(queryLower));
      });

      if (problems.length === 0) {
        console.log(chalk.yellow(`No problems found matching "${query}"`));
        db.close();
        return;
      }

      console.log(chalk.green(`Found ${problems.length} problem(s) matching "${query}":\n`));

      const choices = problems.map(p => ({
        name: `[${p.difficulty}] ${p.title} (${p.platform}) - ${p.topic}`,
        value: p
      }));

      const { selectedProblem } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedProblem',
          message: 'Select a problem to open (or press Ctrl+C to exit):',
          choices
        }
      ]);

      const problemDir = path.dirname(path.join(workspaceRoot, selectedProblem.file_path));

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Open notes file', value: 'notes' },
            { name: 'Open problem directory', value: 'dir' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);

      if (action === 'notes') {
        const notesPath = path.join(workspaceRoot, selectedProblem.file_path);
        await openItem(notesPath);
      } else if (action === 'dir') {
        await openItem(problemDir);
      }

      db.close();

    } catch (error) {
      ErrorHandler.handleErrorAndExit(error as Error);
    }
  });

async function openItem(itemPath: string) {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      await execAsync(`start "" "${itemPath}"`);
    } else if (platform === 'darwin') {
      await execAsync(`open "${itemPath}"`);
    } else {
      await execAsync(`xdg-open "${itemPath}"`);
    }
    console.log(chalk.green(`Opened ${itemPath}`));
  } catch (err) {
    console.error(chalk.red(`Failed to open: ${(err as Error).message}`));
  }
}
