import { Command } from 'commander';
import { DatabaseService } from '../../database/DatabaseService.js';
import { RevisionEngine } from '../../services/RevisionEngine.js';
import { ConfigService } from '../../services/ConfigService.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import { logger } from '../../services/Logger.js';
import { ReviewOutcome } from '../../types/index.js';
import chalk from 'chalk';
import path from 'path';
import inquirer from 'inquirer';

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tempI = newArray[i]!;
    const tempJ = newArray[j]!;
    newArray[i] = tempJ;
    newArray[j] = tempI;
  }
  return newArray;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export const mockCommand = new Command('mock')
  .description('Start a timed random mock interview')
  .argument('[count]', 'Number of problems to solve', '3')
  .option('-p, --platform <platform>', 'Filter by platform (leetcode/geeksforgeeks)')
  .option('-t, --topic <topic>', 'Filter by topic')
  .option('-d, --difficulty <difficulty>', 'Filter by difficulty (Easy/Medium/Hard)')
  .action(async (countArg: string, options) => {
    const workspaceRoot = process.cwd();
    
    try {
      const count = parseInt(countArg, 10);
      if (isNaN(count) || count <= 0) {
        throw new Error('Count must be a positive number');
      }

      console.log(chalk.blue('Setting up Mock Interview...'));
      
      const configService = new ConfigService(workspaceRoot);
      await configService.initialize();

      const dbPath = path.join(workspaceRoot, 'reviews', 'dsa-vault.db');
      const db = new DatabaseService({ path: dbPath });
      const revisionEngine = new RevisionEngine(db);

      // Build filters
      const filters: any = {};
      if (options.platform) filters.platform = options.platform;
      if (options.topic) filters.topic = options.topic;
      if (options.difficulty) filters.difficulty = options.difficulty;

      const allProblems = db.getProblems(filters);

      if (allProblems.length === 0) {
        console.log(chalk.yellow('No problems found matching your criteria to build a mock interview.'));
        db.close();
        return;
      }

      const mockProblems = shuffleArray(allProblems).slice(0, count);
      const actualCount = mockProblems.length;

      console.log(chalk.bold.magenta('\n🎯 MOCK INTERVIEW SETUP'));
      console.log(`Problems selected: ${chalk.bold(actualCount)}`);
      
      if (actualCount < count) {
        console.log(chalk.yellow(`Note: You requested ${count} problems, but only ${actualCount} matched your criteria.`));
      }

      // Recommend 20 mins per problem
      const recommendedMinutes = actualCount * 20;
      console.log(`Recommended Time Limit: ${chalk.bold.cyan(recommendedMinutes + ' minutes')}\n`);

      console.log(chalk.bold('Problems:'));
      mockProblems.forEach((p, idx) => {
        console.log(`${idx + 1}. [${chalk.cyan(p.difficulty)}] ${p.title} (${p.topic})`);
      });

      const { ready } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'ready',
          message: 'Are you ready to start the timer?',
          default: true
        }
      ]);

      if (!ready) {
        console.log(chalk.yellow('Mock interview aborted.'));
        db.close();
        return;
      }

      const startTime = Date.now();
      
      console.clear();
      console.log(chalk.bold.green('\n⏱️  YOUR TIME STARTS NOW!\n'));
      
      mockProblems.forEach((p, idx) => {
        console.log(chalk.bold.cyan(`=== Problem ${idx + 1}: ${p.title} ===`));
        console.log(`Difficulty: ${p.difficulty}`);
        console.log(`Topic:      ${p.topic}`);
        console.log(`URL:        ${chalk.underline(p.url)}`);
        console.log(`File:       ${path.join(workspaceRoot, p.file_path)}\n`);
      });

      console.log(chalk.magenta('Leave this terminal window open.'));
      
      const { finishAction } = await inquirer.prompt([
        {
          type: 'input',
          name: 'finishAction',
          message: 'Press ENTER when you have finished all problems (or type "quit" to abort)...'
        }
      ]);

      if (finishAction.toLowerCase().trim() === 'quit') {
        console.log(chalk.yellow('Mock interview aborted.'));
        db.close();
        return;
      }

      const endTime = Date.now();
      const elapsedMs = endTime - startTime;
      
      console.log(chalk.bold.green(`\n🎉 Interview Complete!`));
      console.log(`Total Time Taken: ${chalk.bold.cyan(formatDuration(elapsedMs))}\n`);

      console.log(chalk.blue('Let\'s review how you did to update your spaced-repetition stats:\n'));

      let sessionOutcomes: Record<ReviewOutcome, number> = {
        easy: 0,
        medium: 0,
        hard: 0,
        failed: 0
      };

      for (let i = 0; i < mockProblems.length; i++) {
        const p = mockProblems[i]!;
        console.log(chalk.bold.cyan(`\nProblem ${i + 1}: ${p.title}`));
        
        const { outcome } = await inquirer.prompt([
          {
            type: 'list',
            name: 'outcome',
            message: 'How well did you solve this?',
            choices: [
              { name: 'Easy (Solved instantly, optimal solution)', value: 'easy' },
              { name: 'Medium (Solved with minor struggle)', value: 'medium' },
              { name: 'Hard (Solved with major struggle/hints)', value: 'hard' },
              { name: 'Failed (Could not solve within time)', value: 'failed' },
              new inquirer.Separator(),
              { name: 'Skip rating', value: 'skip' }
            ]
          }
        ]);

        if (outcome !== 'skip') {
          const validOutcome = outcome as ReviewOutcome;
          revisionEngine.recordReview(p.id, validOutcome); // Using problem ID
          sessionOutcomes[validOutcome]++;
          console.log(chalk.green('✓ Stats updated.'));
        } else {
          console.log(chalk.gray('Skipped rating.'));
        }
      }

      console.log(chalk.bold.magenta('\n=== Interview Summary ==='));
      console.log(`Total Time:  ${formatDuration(elapsedMs)}`);
      console.log(`Easy:        ${sessionOutcomes.easy}`);
      console.log(`Medium:      ${sessionOutcomes.medium}`);
      console.log(`Hard:        ${sessionOutcomes.hard}`);
      console.log(`Failed:      ${sessionOutcomes.failed}\n`);

      logger.info('mock', 'Completed mock interview', { elapsedMs, sessionOutcomes });

      db.close();

    } catch (error) {
      ErrorHandler.handleErrorAndExit(error as Error);
    }
  });
