import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { captureCommand } from './commands/capture.js';
import { reviewCommand } from './commands/review.js';
import { statsCommand } from './commands/stats.js';
import { searchCommand } from './commands/search.js';
import { listCommand } from './commands/list.js';
import { configCommand } from './commands/config.js';
import { syncCommand } from './commands/sync.js';
import { doctorCommand } from './commands/doctor.js';
import { importCommand } from './commands/import.js';
// We will import other commands as they are implemented

const program = new Command();

program
  .name('dsa-vault')
  .description('Local-first CLI tool for capturing and reviewing coding problems with spaced-repetition')
  .version('1.0.0');

// Register commands
program.addCommand(initCommand);
program.addCommand(captureCommand);
program.addCommand(reviewCommand);
program.addCommand(statsCommand);
program.addCommand(searchCommand)
  .addCommand(listCommand);
program.addCommand(configCommand);
program.addCommand(syncCommand);
program.addCommand(doctorCommand);
program.addCommand(importCommand);

// Export for testing or programmatic usage
export { program };
