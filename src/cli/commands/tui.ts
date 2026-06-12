import { Command } from 'commander';
import { DatabaseService } from '../../database/DatabaseService.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import { Dashboard } from '../../tui/Dashboard.js';
import path from 'path';

export const tuiCommand = new Command('tui')
  .description('Launch the full-screen interactive dashboard')
  .action(async () => {
    const workspaceRoot = process.cwd();
    
    try {
      const dbPath = path.join(workspaceRoot, 'reviews', 'dsa-vault.db');
      const db = new DatabaseService({ path: dbPath });

      const dashboard = new Dashboard(db);
      await dashboard.render();

      // Ensure the process doesn't exit immediately; dashboard handles closing via Q/Esc keys
    } catch (error) {
      ErrorHandler.handleErrorAndExit(error as Error);
    }
  });
