import { Command } from 'commander';
import { DatabaseService } from '../../database/DatabaseService.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import chalk from 'chalk';
import path from 'path';

export const statsCommand = new Command('stats')
  .description('Display statistics about your learning progress')
  .action(async () => {
    const workspaceRoot = process.cwd();
    
    try {
      const dbPath = path.join(workspaceRoot, 'reviews', 'dsa-vault.db');
      const db = new DatabaseService({ path: dbPath });

      const problems = db.getProblems({});
      const totalProblems = problems.length;

      if (totalProblems === 0) {
        console.log(chalk.yellow('No problems found in the vault yet. Capture some problems to see stats!'));
        db.close();
        return;
      }

      const stats = db.getStats();

      // We still need to calculate total reviews
      const totalReviewsResult = db['db'].prepare('SELECT SUM(review_count) as total FROM reviews').get() as { total: number | null };
      const totalReviews = totalReviewsResult.total || 0;

      // To calculate streak, we need review history
      // Better-SQLite3: we can just query review_history
      const historyRows = db['db'].prepare('SELECT review_date FROM review_history ORDER BY review_date DESC').all() as { review_date: string }[];
      
      let streak = 0;
      if (historyRows.length > 0) {
        const uniqueDates = Array.from(new Set(historyRows.map(row => row.review_date.split('T')[0])));
        
        // Calculate streak
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // normalize time
        
        let expectedDateStr = currentDate.toISOString().split('T')[0];
        
        // Check if reviewed today, otherwise start checking from yesterday
        if (uniqueDates[0] === expectedDateStr) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
          expectedDateStr = currentDate.toISOString().split('T')[0];
        } else {
          currentDate.setDate(currentDate.getDate() - 1);
          expectedDateStr = currentDate.toISOString().split('T')[0];
          if (uniqueDates[0] === expectedDateStr) {
            streak++; // Streak alive from yesterday
            currentDate.setDate(currentDate.getDate() - 1);
            expectedDateStr = currentDate.toISOString().split('T')[0];
          }
        }

        for (let i = (streak > 0 && uniqueDates[0] !== new Date().toISOString().split('T')[0] ? 0 : 1); i < uniqueDates.length; i++) {
          if (uniqueDates[i] === expectedDateStr) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
            expectedDateStr = currentDate.toISOString().split('T')[0];
          } else {
            break;
          }
        }
      }

      const avgReviews = stats.totalProblems > 0 ? (totalReviews / stats.totalProblems).toFixed(1) : 0;

      console.log(chalk.bold.magenta('\n=== DSA Vault Statistics ===\n'));
      
      console.log(chalk.bold.cyan('Overview'));
      console.log(`Total Problems:  ${chalk.bold(stats.totalProblems)}`);
      console.log(`Due for Review:  ${chalk.bold(stats.dueCount)}`);
      console.log(`Current Streak:  ${chalk.bold(streak)} days`);
      console.log(`Avg Reviews/Prob:${chalk.bold(avgReviews)}\n`);

      console.log(chalk.bold.cyan('Mastery (Confidence)'));
      console.log(`Strong: ${chalk.green(stats.byConfidence.strong || 0)}`);
      console.log(`Medium: ${chalk.yellow(stats.byConfidence.medium || 0)}`);
      console.log(`Weak:   ${chalk.red(stats.byConfidence.weak || 0)}\n`);

      const printMap = (title: string, map: Record<string, number>) => {
        console.log(chalk.bold.cyan(title));
        Object.entries(map)
          .sort((a, b) => b[1] - a[1]) // Sort by count desc
          .forEach(([k, v]) => {
            console.log(`${k.padEnd(15)} ${v}`);
          });
        console.log();
      };

      printMap('By Difficulty', stats.byDifficulty);
      printMap('By Platform', stats.byPlatform);
      printMap('Top Topics', stats.byTopic);
      // Wait, language stats are not in getStats(). Let's calculate them quickly.
      const languageStats: Record<string, number> = {};
      for (const p of problems) {
        languageStats[p.language] = (languageStats[p.language] || 0) + 1;
      }
      printMap('By Language', languageStats);

      db.close();

    } catch (error) {
      ErrorHandler.handleErrorAndExit(error as Error);
    }
  });
