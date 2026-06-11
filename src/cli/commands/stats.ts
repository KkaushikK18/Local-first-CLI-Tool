import { Command } from 'commander';
import { DatabaseService } from '../../database/DatabaseService.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import chalk from 'chalk';
import path from 'path';

export const statsCommand = new Command('stats')
  .description('View learning analytics, streaks, and mastery progress')
  .action(async () => {
    const workspaceRoot = process.cwd();
    
    try {
      const dbPath = path.join(workspaceRoot, 'reviews', 'dsa-vault.db');
      const db = new DatabaseService({ path: dbPath });

      const problems = db.getProblems({});
      if (problems.length === 0) {
        console.log(chalk.yellow('No problems found in the vault yet. Capture some problems to see stats!'));
        db.close();
        return;
      }

      const stats = db.getStats();
      const streaks = db.getStreakStats();

      // Calculate total reviews
      const totalReviewsResult = db.getRawDatabase().prepare('SELECT SUM(review_count) as total FROM reviews').get() as { total: number | null };
      const totalReviews = totalReviewsResult.total || 0;
      const avgReviews = stats.totalProblems > 0 ? (totalReviews / stats.totalProblems).toFixed(1) : '0';

      console.log(chalk.bold.blue('\n📊 DSA Vault Analytics\n'));

      // 1. Streaks
      console.log(chalk.bold.magenta('🔥 Streaks & Activity'));
      console.log(`Current Streak:    ${chalk.green(streaks.currentStreak + ' days')}`);
      console.log(`Longest Streak:    ${chalk.cyan(streaks.longestStreak + ' days')}`);
      console.log(`Total Active Days: ${streaks.totalReviewDays} days\n`);

      // 2. Overall Progress
      console.log(chalk.bold.magenta('📚 Vault Overview'));
      console.log(`Total Problems:    ${stats.totalProblems}`);
      console.log(`Total Reviews:     ${totalReviews} (${avgReviews} avg per problem)`);
      console.log(`Due for Review:    ${stats.dueCount > 0 ? chalk.yellow(stats.dueCount) : chalk.green(0)}\n`);

      // 5. Confidence Overview
      if (Object.keys(stats.byConfidence).length > 0) {
        console.log(chalk.bold.magenta('💪 Mastery Level (Confidence)'));
        const strong = stats.byConfidence['strong'] || 0;
        const medium = stats.byConfidence['medium'] || 0;
        const weak = stats.byConfidence['weak'] || 0;
        
        console.log(`Strong: ${chalk.green('🟩'.repeat(strong))} ${strong}`);
        console.log(`Medium: ${chalk.yellow('🟨'.repeat(medium))} ${medium}`);
        console.log(`Weak:   ${chalk.red('🟥'.repeat(weak))} ${weak}\n`);
      }

      const printMap = (title: string, map: Record<string, number>) => {
        if (Object.keys(map).length === 0) return;
        console.log(chalk.bold.magenta(title));
        Object.entries(map)
          .sort((a, b) => b[1] - a[1]) // Sort by count desc
          .forEach(([k, v]) => {
            console.log(`${k.padEnd(16)} ${v}`);
          });
        console.log();
      };

      printMap('🌐 By Platform', stats.byPlatform);
      printMap('📈 By Difficulty', stats.byDifficulty);
      printMap('🧠 Top Topics', stats.byTopic);
      
      const languageStats: Record<string, number> = {};
      for (const p of problems) {
        if (p.language && p.language.length <= 20) {
          languageStats[p.language] = (languageStats[p.language] || 0) + 1;
        } else {
          languageStats['unknown'] = (languageStats['unknown'] || 0) + 1;
        }
      }
      printMap('💻 By Language', languageStats);

      db.close();

    } catch (error) {
      ErrorHandler.handleErrorAndExit(error as Error);
    }
  });
