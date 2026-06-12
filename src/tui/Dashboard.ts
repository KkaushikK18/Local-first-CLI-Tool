import blessed from 'neo-blessed';
import { DatabaseService } from '../database/DatabaseService.js';
import { RevisionEngine } from '../services/RevisionEngine.js';
import { ProblemEntry } from '../types/index.js';
import chalk from 'chalk';

export class Dashboard {
  private screen: blessed.Widgets.Screen;
  private header: blessed.Widgets.BoxElement;
  private queueList: blessed.Widgets.ListElement;
  private inspector: blessed.Widgets.BoxElement;
  private footer: blessed.Widgets.BoxElement;
  
  private db: DatabaseService;
  private revisionEngine: RevisionEngine;
  private problems: ProblemEntry[] = [];
  private selectedIndex = 0;

  constructor(db: DatabaseService) {
    this.db = db;
    this.revisionEngine = new RevisionEngine(db);

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'DSA Vault - Dashboard',
      fullUnicode: true,
    });

    // 1. Header
    this.header = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: 'Loading...',
      tags: true,
      style: {
        fg: 'white',
        bg: 'blue',
      },
      border: { type: 'line' },
    });

    // 2. Queue List (Left)
    this.queueList = blessed.list({
      parent: this.screen,
      top: 3,
      left: 0,
      width: '60%',
      height: '100%-3',
      keys: true,
      vi: true,
      mouse: true,
      tags: true,
      border: { type: 'line' },
      style: {
        selected: {
          bg: 'magenta',
          fg: 'white',
        },
        border: { fg: 'cyan' },
      },
      label: ' Upcoming Review Queue ',
    });

    // 3. Problem Inspector (Right)
    this.inspector = blessed.box({
      parent: this.screen,
      top: 3,
      left: '60%',
      width: '40%',
      height: '100%-6',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'yellow' },
      },
      label: ' Problem Inspector ',
    });

    // 4. Action Menu (Bottom Right)
    this.footer = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: '60%',
      width: '40%',
      height: 3,
      tags: true,
      content: '{bold}[R]{/bold} Review Due  {bold}[M]{/bold} Mock  {bold}[C]{/bold} Capture  {bold}[Q]{/bold} Quit',
      border: { type: 'line' },
      style: {
        border: { fg: 'green' },
      },
    });

    this.setupEvents();
  }

  private setupEvents() {
    // Quit on Q, Esc, or Ctrl-C
    this.screen.key(['q', 'escape', 'C-c'], () => {
      this.close();
      return process.exit(0);
    });

    // Navigate list
    this.queueList.on('select item', (item, index) => {
      this.selectedIndex = index;
      this.updateInspector();
      this.screen.render();
    });

    // Allow opening hint by pressing 'h'
    this.screen.key(['h'], () => {
      const p = this.problems[this.selectedIndex];
      if (p && p.metadata.hint) {
        this.inspector.setContent(this.inspector.content.replace('{hidden}', '{magenta-fg}' + p.metadata.hint + '{/magenta-fg}'));
        this.screen.render();
      }
    });

    // Handle action menu keys
    this.screen.key(['r'], () => {
      this.close();
      console.log(chalk.green('To start your reviews, run: ') + chalk.bold('dsa-vault review'));
      process.exit(0);
    });

    this.screen.key(['m'], () => {
      this.close();
      console.log(chalk.green('To start a mock interview, run: ') + chalk.bold('dsa-vault mock'));
      process.exit(0);
    });

    this.screen.key(['c'], () => {
      this.close();
      console.log(chalk.green('To capture a new problem, run: ') + chalk.bold('dsa-vault capture'));
      process.exit(0);
    });
  }

  public async render() {
    this.loadData();
    this.queueList.focus();
    this.screen.render();
  }

  private loadData() {
    // Get stats for header
    const stats = this.db.getStats();
    const streaks = this.db.getStreakStats();
    
    this.header.setContent(` {bold}🔥 ${stats.dueCount} Problems Due for Review Today | Current Streak: ${streaks.currentStreak} Days{/bold}`);

    // Load queue logic
    // Let's get ALL problems but sort them: Due first, then weak, then rest
    const allProblems = this.revisionEngine.getDueProblems({ due: false });
    const dueProblems = this.revisionEngine.getDueProblems({ due: true });
    
    const dueIds = new Set(dueProblems.map(p => p.id));
    
    // Sort logic: Due today -> Weak/Failed recently -> Others (sorted by next review date)
    this.problems = allProblems.sort((a, b) => {
      const aDue = dueIds.has(a.id);
      const bDue = dueIds.has(b.id);
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      
      const aWeak = a.reviewStats.confidenceScore === 'weak';
      const bWeak = b.reviewStats.confidenceScore === 'weak';
      if (aWeak && !bWeak) return -1;
      if (!aWeak && bWeak) return 1;

      return a.reviewStats.nextReviewDate.getTime() - b.reviewStats.nextReviewDate.getTime();
    });

    // Populate list
    const listItems = this.problems.map(p => {
      let icon = '🟢';
      if (dueIds.has(p.id)) icon = '🔴';
      else if (p.reviewStats.confidenceScore === 'weak') icon = '🟡';
      
      const diffStr = p.metadata.difficulty.padEnd(6);
      return `${icon} [${diffStr}] ${p.metadata.title}`;
    });

    this.queueList.setItems(listItems as any);
    if (this.problems.length > 0) {
      this.updateInspector();
    }
  }

  private updateInspector() {
    if (this.problems.length === 0) return;
    
    const p = this.problems[this.selectedIndex]!;
    
    let content = `{bold}${p.metadata.title}{/bold}\n`;
    content += `URL: {underline}${p.metadata.url}{/underline}\n\n`;
    
    content += `{cyan-fg}=== Anki Stats ==={/cyan-fg}\n`;
    content += `Mastery Level: ${p.reviewStats.confidenceScore}\n`;
    content += `Total Reviews: ${p.reviewStats.reviewCount}\n`;
    content += `Ease Factor:   ${p.reviewStats.easeFactor.toFixed(2)}\n`;
    content += `Next Interval: ${p.reviewStats.currentInterval} days\n`;
    content += `Next Date:     ${p.reviewStats.nextReviewDate.toISOString().split('T')[0]}\n\n`;

    content += `{yellow-fg}=== Hint ==={/yellow-fg}\n`;
    if (p.metadata.hint) {
      content += `(Press 'H' to reveal hint)\n{hidden}`;
    } else {
      content += `No hint saved for this problem.\n`;
    }

    this.inspector.setContent(content);
  }

  public close() {
    this.screen.destroy();
  }
}
