import { Command } from 'commander';
import { DatabaseService } from '../../database/DatabaseService.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import chalk from 'chalk';
import path from 'path';

export const listCommand = new Command('list')
  .description('List all problems or filter by status')
  .option('-d, --due', 'Only show problems that are currently due for review')
  .action(async (options) => {
    const workspaceRoot = process.cwd();
    
    try {
      const dbPath = path.join(workspaceRoot, 'reviews', 'dsa-vault.db');
      const db = new DatabaseService({ path: dbPath });

      const problems = db.getProblems({});
      let problemsWithReviews = problems.map(p => {
        const review = db.findReviewByProblemId(p.id);
        return {
          ...p,
          next_review: review?.next_review_date || new Date().toISOString(),
          confidence: review?.confidence_score || 'weak'
        };
      });

      if (options.due) {
        // Filter out problems that are due
        const now = new Date();
        problemsWithReviews = problemsWithReviews.filter(p => new Date(p.next_review) <= now);
        console.log(chalk.bold.magenta(`\n=== Problems Due for Review (${problemsWithReviews.length}) ===\n`));
      } else {
        console.log(chalk.bold.magenta(`\n=== All Captured Problems (${problemsWithReviews.length}) ===\n`));
      }

      if (problemsWithReviews.length === 0) {
        console.log(chalk.yellow('No problems found.'));
        db.close();
        return;
      }

      // Sort by next_review date (earliest first)
      problemsWithReviews.sort((a, b) => new Date(a.next_review).getTime() - new Date(b.next_review).getTime());

      problemsWithReviews.forEach(p => {
        const dateObj = new Date(p.next_review);
        const isDue = dateObj <= new Date();
        const dateStr = dateObj.toISOString().split('T')[0];
        
        const statusColor = isDue ? chalk.red : chalk.green;
        const confidenceColor = p.confidence === 'strong' ? chalk.green : (p.confidence === 'medium' ? chalk.yellow : chalk.red);
        
        console.log(`• ${chalk.bold(p.title)} ${chalk.dim(`(${p.platform})`)}`);
        console.log(`  Next Review: ${statusColor(dateStr)} | Confidence: ${confidenceColor(p.confidence)} | Topic: ${chalk.cyan(p.topic)}`);
        console.log();
      });

      db.close();

    } catch (error) {
      ErrorHandler.handleErrorAndExit(error as Error);
    }
  });
