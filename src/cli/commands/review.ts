import { Command } from 'commander';
import { RevisionEngine } from '../../services/RevisionEngine.js';
import { DatabaseService } from '../../database/DatabaseService.js';
import { ConfigService } from '../../services/ConfigService.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import { logger } from '../../services/Logger.js';
import { ReviewOutcome, ProblemEntry } from '../../types/index.js';
import chalk from 'chalk';
import path from 'path';
import inquirer from 'inquirer';

export const reviewCommand = new Command('review')
  .description('Start an interactive review session for spaced repetition')
  .option('--due', 'Review only due problems')
  .option('--weak', 'Review only problems with weak confidence')
  .option('-p, --platform <platform>', 'Filter by platform (leetcode/geeksforgeeks)')
  .option('-t, --topic <topic>', 'Filter by topic')
  .option('-d, --difficulty <difficulty>', 'Filter by difficulty (Easy/Medium/Hard)')
  .action(async (options) => {
    const workspaceRoot = process.cwd();
    
    try {
      console.log(chalk.blue('Starting review session...'));
      logger.info('review', 'Started review session', { options });

      const configService = new ConfigService(workspaceRoot);
      await configService.initialize();

      const dbPath = path.join(workspaceRoot, 'reviews', 'dsa-vault.db');
      const db = new DatabaseService({ path: dbPath });
      const revisionEngine = new RevisionEngine(db);

      // Build filters
      const filters: Parameters<typeof revisionEngine.getDueProblems>[0] = {};
      if (options.due) filters.due = true;
      if (options.weak) filters.weak = true;
      if (options.platform) filters.platform = options.platform;
      if (options.topic) filters.topic = options.topic;
      if (options.difficulty) filters.difficulty = options.difficulty;

      // Default to due if no filters provided
      if (Object.keys(filters).length === 0) {
        filters.due = true;
      }

      const problemsToReview = revisionEngine.getDueProblems(filters);

      if (problemsToReview.length === 0) {
        console.log(chalk.green('🎉 You are all caught up! No problems match the criteria.'));
        db.close();
        return;
      }

      console.log(chalk.yellow(`Found ${problemsToReview.length} problem(s) to review.\n`));

      let reviewedCount = 0;
      let sessionOutcomes: Record<ReviewOutcome, number> = {
        easy: 0,
        medium: 0,
        hard: 0,
        failed: 0
      };

      for (const problem of problemsToReview) {
        console.log(chalk.bold.cyan(`\n=== Reviewing: ${problem.metadata.title} ===`));
        console.log(`Platform:   ${problem.metadata.platform}`);
        console.log(`Difficulty: ${problem.metadata.difficulty}`);
        console.log(`Tags:       ${problem.metadata.tags.join(', ')}`);
        console.log(`URL:        ${chalk.underline(problem.metadata.url)}`);
        console.log(`File:       ${path.join(workspaceRoot, problem.filePath)}`);
        console.log(chalk.gray(`Next Review: ${problem.reviewStats?.nextReviewDate.toISOString().split('T')[0] || 'N/A'}`));
        
        console.log(chalk.blue('\nTask: Open the file or URL, review your notes/solution, and recall the key insight.'));

        if (problem.metadata.hint) {
          const { action } = await inquirer.prompt([
            {
              type: 'input',
              name: 'action',
              message: 'Press Enter to reveal outcome menu, or type "h" for a hint:',
            }
          ]);
          if (action.toLowerCase().trim() === 'h') {
            console.log(chalk.magenta(`\n💡 Hint: ${problem.metadata.hint}\n`));
            await inquirer.prompt([
              {
                type: 'input',
                name: 'continue',
                message: 'Press Enter to reveal outcome menu...',
              }
            ]);
          }
        } else {
          await inquirer.prompt([
            {
              type: 'input',
              name: 'continue',
              message: 'Press Enter to reveal outcome menu...',
            }
          ]);
        }

        const { outcome } = await inquirer.prompt([
          {
            type: 'list',
            name: 'outcome',
            message: 'How well did you recall this problem?',
            choices: [
              { name: 'Easy (Recalled instantly, optimal solution)', value: 'easy' },
              { name: 'Medium (Recalled with minor struggle, good solution)', value: 'medium' },
              { name: 'Hard (Recalled with major struggle or hints)', value: 'hard' },
              { name: 'Failed (Could not recall, needed to read solution)', value: 'failed' },
              new inquirer.Separator(),
              { name: 'Skip / Exit Session', value: 'exit' }
            ]
          }
        ]);

        if (outcome === 'exit') {
          console.log(chalk.yellow('\nReview session ended early.'));
          break;
        }

        const validOutcome = outcome as ReviewOutcome;
        
        // Record the review
        revisionEngine.recordReview(problem.id, validOutcome);
        
        reviewedCount++;
        sessionOutcomes[validOutcome]++;

        // Fetch updated stats to show the user
        const updatedProblem = db.findProblemByUrl(problem.metadata.url);
        const updatedReview = db.findReviewByProblemId(problem.id);
        if (updatedProblem && updatedReview) {
          console.log(chalk.green(`✓ Recorded. Next review: ${updatedReview.next_review_date}`));
        }
      }

      // Session Summary
      if (reviewedCount > 0) {
        console.log(chalk.bold.magenta('\n=== Session Summary ==='));
        console.log(`Total Reviewed: ${reviewedCount} / ${problemsToReview.length}`);
        console.log(`Easy:   ${sessionOutcomes.easy}`);
        console.log(`Medium: ${sessionOutcomes.medium}`);
        console.log(`Hard:   ${sessionOutcomes.hard}`);
        console.log(`Failed: ${sessionOutcomes.failed}`);
        logger.info('review_summary', 'Completed review session', { reviewedCount, sessionOutcomes });
      }

      db.close();
      
    } catch (error) {
      ErrorHandler.handleErrorAndExit(error as Error);
    }
  });
