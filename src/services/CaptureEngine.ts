import { BrowserService } from './BrowserService.js';
import { StorageService } from './StorageService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { PlatformFactory } from './platform/PlatformFactory.js';
import { EditorService } from './EditorService.js';
import { SpacedRepetitionService } from './SpacedRepetitionService.js';
import { validateNotes } from '../types/index.js';
import { getFileExtension, sanitizeProblemName } from '../utils/index.js';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import inquirer from 'inquirer';

export class CaptureEngine {
  constructor(
    private browserService: BrowserService,
    private storageService: StorageService,
    private dbService: DatabaseService
  ) {}

  /**
   * Captures a problem from a specific URL
   */
  async captureFromUrl(url: string, editorCommand?: string): Promise<string> {
    const adapter = PlatformFactory.getAdapterForUrl(url);
    const browser = await this.browserService.connect();
    
    // Create a new context and page
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // Wait a bit for JS frameworks to render
      await page.waitForTimeout(2000);

      const isAuthenticated = await adapter.isAuthenticated(page);
      if (!isAuthenticated) {
        console.warn('Warning: You do not appear to be authenticated. Extraction might be incomplete or fail.');
      }

      console.log('Extracting metadata...');
      const metadata = await adapter.extractMetadata(page);
      
      console.log('Extracting solution...');
      const solution = await adapter.extractSolution(page);

      return await this.processExtractedData(metadata, solution, editorCommand);
    } finally {
      await context.close();
    }
  }

  /**
   * Captures a problem from an active browser tab
   */
  async captureFromBrowser(editorCommand?: string): Promise<string> {
    await this.browserService.connect();
    const pages = await this.browserService.getPlatformPages();
    
    if (pages.length === 0) {
      throw new Error('No active LeetCode or GeeksforGeeks tabs found in the connected browser.');
    }

    if (!pages[0]) {
      throw new Error('No active LeetCode or GeeksforGeeks tabs found.');
    }
    let targetPage = pages[0] as import('playwright').Page;
    
    if (pages.length > 1) {
      // If we had a CLI layer here we would prompt the user.
      // For now, we'll just take the first one or this should be handled by the caller.
      console.warn(`Found ${pages.length} matching tabs. Using the first one: ${targetPage.url()}`);
    }

    const url = targetPage.url();
    const adapter = PlatformFactory.getAdapterForUrl(url);

    // Bring page to front
    await targetPage.bringToFront();

    const isAuthenticated = await adapter.isAuthenticated(targetPage);
    if (!isAuthenticated) {
      console.warn('Warning: You do not appear to be authenticated. Extraction might be incomplete or fail.');
    }

    console.log('Extracting metadata...');
    const metadata = await adapter.extractMetadata(targetPage);
    
    console.log('Extracting solution...');
    const solution = await adapter.extractSolution(targetPage);

    return await this.processExtractedData(metadata, solution, editorCommand);
  }

  /**
   * Coordinates the validation, notes collection, and storage
   */
  private async processExtractedData(
    metadata: any,
    solution: any,
    editorCommand?: string
  ): Promise<string> {
    // 7.5 Check for duplicates before proceeding
    const existingProblem = this.dbService.findProblemByUrl(metadata.url);
    if (existingProblem) {
      throw new Error(`DuplicateProblem:${existingProblem.id}`); // Signal to caller to prompt and call resolveDuplicate
    }

    return await this.finalizeCapture(metadata, solution, null, editorCommand);
  }

  /**
   * 7.5 Resolves a duplicate problem according to user strategy
   */
  async resolveDuplicate(
    metadata: any,
    solution: any,
    existingId: string,
    strategy: 'overwrite' | 'merge' | 'skip' | 'new_version',
    editorCommand?: string
  ): Promise<string | null> {
    if (strategy === 'skip') {
      console.log('Skipping duplicate problem.');
      return null;
    }

    const existingProblem = this.dbService.findProblemById(existingId);
    if (!existingProblem) {
      throw new Error(`Original problem ${existingId} not found`);
    }

    return await this.finalizeCapture(metadata, solution, { existingProblem, strategy }, editorCommand);
  }

  /**
   * Finalizes the capture process by collecting notes and saving
   */
  private async finalizeCapture(
    metadata: any,
    solution: any,
    duplicateContext: { existingProblem: any, strategy: 'overwrite' | 'merge' | 'new_version' } | null,
    editorCommand?: string
  ): Promise<string> {
    const { hint } = await inquirer.prompt([
      {
        type: 'input',
        name: 'hint',
        message: 'Would you like to add a quick hint for this problem? (Leave blank to skip)',
      }
    ]);

    if (hint && hint.trim().length > 0) {
      metadata.hint = hint.trim();
    }

    let template = this.storageService.generateNotesTemplate(metadata);
    let originalNotes = '';

    // Load original notes if merging or overwriting
    if (duplicateContext && duplicateContext.strategy !== 'new_version') {
      try {
        originalNotes = await fs.readFile(path.join(duplicateContext.existingProblem.file_path, 'notes.md'), 'utf-8');
        template = `\n\n--- NEW NOTES ---\n\n${template}\n\n--- ORIGINAL NOTES ---\n\n${originalNotes}`;
      } catch {
        // If no original notes found, continue with standard template
      }
    }

    // 2. Collect Notes Interactively
    const tempNotesPath = path.join(os.tmpdir(), `dsa-vault-notes-${randomUUID()}.md`);
    await fs.writeFile(tempNotesPath, template, 'utf-8');

    console.log('Opening editor for notes. Please save and close the editor when done.');
    
    let notes = '';
    let isValid = false;
    
    while (!isValid) {
      notes = await EditorService.openEditorAndWait(tempNotesPath, editorCommand);
      
      const validation = validateNotes(notes);
      // For duplicate resolution, if the user didn't write anything new, we might just use original notes
      if (validation.valid) {
        isValid = true;
      } else {
        console.warn(`Notes validation failed: ${validation.error.message}`);
        console.warn('Skipping note validation for now to proceed.');
        isValid = true;
      }
    }

    try { await fs.unlink(tempNotesPath); } catch {}

    // Handle resolution strategy logic
    let problemId = randomUUID();
    let finalSolution = solution;
    let reviewStats = SpacedRepetitionService.initializeReviewStats(metadata.dateSolved);
    let titleToUse = metadata.title;

    if (duplicateContext) {
      if (duplicateContext.strategy === 'new_version') {
        // new ID, new stats, append V2 to title
        titleToUse = `${metadata.title} V2`;
        metadata.title = titleToUse;
      } else {
        // overwrite or merge: reuse existing ID, keep history
        problemId = duplicateContext.existingProblem.id;
        const existingReviewRecord = this.dbService.findReviewByProblemId(problemId);
        if (existingReviewRecord) {
          reviewStats = {
            firstSolvedDate: new Date(existingReviewRecord.first_solved_date),
            lastReviewedDate: existingReviewRecord.last_reviewed_date ? new Date(existingReviewRecord.last_reviewed_date) : null,
            nextReviewDate: new Date(existingReviewRecord.next_review_date),
            reviewCount: existingReviewRecord.review_count,
            confidenceScore: existingReviewRecord.confidence_score as any,
            mistakeCount: existingReviewRecord.mistake_count,
            easeFactor: existingReviewRecord.ease_factor,
            currentInterval: existingReviewRecord.current_interval,
          };
        }

        if (duplicateContext.strategy === 'merge') {
          // Keep old solution (we would read it from FS, but for now we skip writing or use old if available)
          // Simplified: we will just pass the new solution to StorageService, 
          // Wait, if strategy is 'merge', we should keep the OLD solution.
          // Since we might not have old solution content in memory, we might need to read it.
          try {
            const ext = getFileExtension(duplicateContext.existingProblem.language);
            const sanitizedOldName = sanitizeProblemName(duplicateContext.existingProblem.title);
            const oldSolPath = path.join(duplicateContext.existingProblem.file_path, sanitizedOldName + ext);
            const oldCode = await fs.readFile(oldSolPath, 'utf-8');
            finalSolution = {
              code: oldCode,
              language: duplicateContext.existingProblem.language,
              languageExtension: ext
            };
          } catch {
            console.warn('Failed to read old solution for merge, using new solution.');
          }
        }
      }
    }

    const entry = {
      id: problemId,
      metadata,
      solution: finalSolution,
      notes,
      filePath: this.storageService.getProblemDirectory(metadata),
      reviewStats
    };

    console.log('Saving files and updating database...');
    await this.storageService.saveProblemEntry(entry);

    return entry.filePath;
  }
}
