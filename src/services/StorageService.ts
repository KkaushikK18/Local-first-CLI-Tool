import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/DatabaseService.js';
import { sanitizeProblemName } from '../utils/index.js';
import {
  type ProblemEntry,
  type ProblemMetadata,
  type Solution,
  createFileSystemError,
  validateProblemMetadata,
} from '../types/index.js';

export interface StorageConfig {
  workspaceRoot: string;
}

export class StorageService {
  private workspaceRoot: string;
  private db: DatabaseService;

  constructor(config: StorageConfig, db: DatabaseService) {
    this.workspaceRoot = config.workspaceRoot;
    this.db = db;
  }

  /**
   * Generates the problem directory path based on the pattern:
   * problems/{platform}/{topic}/{sanitized-name}
   */
  getProblemDirectory(metadata: ProblemMetadata): string {
    const sanitizedName = sanitizeProblemName(metadata.title);
    return path.join(
      this.workspaceRoot,
      'problems',
      metadata.platform,
      metadata.topic,
      sanitizedName
    );
  }

  /**
   * 4.1 Create directory structure
   */
  async createDirectoryStructure(metadata: ProblemMetadata): Promise<string> {
    const dirPath = this.getProblemDirectory(metadata);
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return dirPath;
    } catch (error) {
      throw createFileSystemError(
        `Failed to create directory: ${dirPath}`,
        'create',
        dirPath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 4.1 Write solution file
   */
  async writeSolutionFile(dirPath: string, solution: Solution, fileName: string): Promise<string> {
    const filePath = path.join(dirPath, fileName + solution.languageExtension);
    try {
      await fs.writeFile(filePath, solution.code, 'utf-8');
      return filePath;
    } catch (error) {
      throw createFileSystemError(
        `Failed to write solution file: ${filePath}`,
        'write',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 4.1 Write notes file
   */
  async writeNotesFile(dirPath: string, notes: string): Promise<string> {
    const filePath = path.join(dirPath, 'notes.md');
    try {
      await fs.writeFile(filePath, notes, 'utf-8');
      return filePath;
    } catch (error) {
      throw createFileSystemError(
        `Failed to write notes file: ${filePath}`,
        'write',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 4.1 Write metadata file
   */
  async writeMetadataFile(dirPath: string, metadata: ProblemMetadata): Promise<string> {
    const filePath = path.join(dirPath, 'meta.json');
    try {
      const content = this.serializeMetadata(metadata);
      await fs.writeFile(filePath, content, 'utf-8');
      return filePath;
    } catch (error) {
      throw createFileSystemError(
        `Failed to write metadata file: ${filePath}`,
        'write',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 4.9 Serialize metadata
   */
  serializeMetadata(metadata: ProblemMetadata): string {
    const validation = validateProblemMetadata(metadata);
    if (!validation.success) {
      throw validation.error;
    }
    
    // Convert dates to ISO strings explicitly if needed, but JSON.stringify does this by default
    return JSON.stringify(metadata, null, 2);
  }

  /**
   * 4.9 Deserialize metadata
   */
  deserializeMetadata(jsonString: string): ProblemMetadata {
    const parsed = JSON.parse(jsonString);
    
    // Revive dates
    if (parsed.dateSolved) {
      parsed.dateSolved = new Date(parsed.dateSolved);
    }
    
    const validation = validateProblemMetadata(parsed);
    if (!validation.success) {
      throw validation.error;
    }
    return validation.data;
  }

  /**
   * 4.7 Generate Notes Template
   */
  generateNotesTemplate(metadata: ProblemMetadata): string {
    // Generate a default template containing the 6 required sections
    return `# Problem: ${metadata.title}

**Platform:** ${metadata.platform}
**Difficulty:** ${metadata.difficulty}
**URL:** ${metadata.url}
**Date Solved:** ${metadata.dateSolved.toISOString().split('T')[0]}

## Approach
<!-- Describe your approach to solving this problem -->

## Complexity
- **Time Complexity:** O(?)
- **Space Complexity:** O(?)

## Key Insight
<!-- What was the key insight or "aha!" moment that led to the solution? -->

## Common Mistakes
<!-- What are some common pitfalls or edge cases to watch out for? -->

## Follow-up Problems
<!-- Are there related problems to practice next? -->
`;
  }

  /**
   * 4.6 Transactional Save with Rollback
   */
  async saveProblemEntry(entry: ProblemEntry): Promise<void> {
    const createdFiles: string[] = [];
    let dirCreated = false;
    let dirPath = entry.filePath;

    try {
      // 1. Create directory structure if it doesn't exist
      if (!existsSync(dirPath)) {
        dirPath = await this.createDirectoryStructure(entry.metadata);
        dirCreated = true;
      }

      // 2. Write files
      const sanitizedName = sanitizeProblemName(entry.metadata.title);
      
      const solutionPath = await this.writeSolutionFile(dirPath, entry.solution, sanitizedName);
      createdFiles.push(solutionPath);
      
      const notesPath = await this.writeNotesFile(dirPath, entry.notes);
      createdFiles.push(notesPath);
      
      const metaPath = await this.writeMetadataFile(dirPath, entry.metadata);
      createdFiles.push(metaPath);

      // 3. Update database using transaction
      this.db.transaction(() => {
        this.db.insertProblem(
          entry.id,
          entry.metadata.platform,
          entry.metadata.title,
          entry.metadata.url,
          entry.metadata.difficulty,
          entry.metadata.tags,
          entry.metadata.topic,
          entry.metadata.language,
          entry.metadata.dateSolved,
          entry.metadata.status,
          dirPath,
          entry.metadata.hint
        );

        this.db.insertReview(
          entry.id, // using problem id as review id for simplicity or generate new
          entry.id,
          entry.reviewStats
        );
      });

    } catch (error) {
      // Rollback: Delete created files
      for (const file of createdFiles) {
        try {
          if (existsSync(file)) {
            await fs.unlink(file);
          }
        } catch (cleanupError) {
          console.error(`Failed to cleanup file ${file} during rollback:`, cleanupError);
        }
      }

      // If we created the directory and it's empty, try to remove it
      if (dirCreated) {
        try {
          if (existsSync(dirPath)) {
            const files = await fs.readdir(dirPath);
            if (files.length === 0) {
              await fs.rmdir(dirPath);
            }
          }
        } catch (cleanupError) {
          console.error(`Failed to cleanup directory ${dirPath} during rollback:`, cleanupError);
        }
      }

      throw error;
    }
  }
}
