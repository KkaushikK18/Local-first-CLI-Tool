import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { StorageService } from '../src/services/StorageService.js';
import { DatabaseService } from '../src/database/DatabaseService.js';
import { type ProblemMetadata } from '../src/types/index.js';

describe('StorageService', () => {
  let db: DatabaseService;
  let storage: StorageService;
  let workspaceRoot: string;
  let dbPath: string;

  beforeEach(async () => {
    workspaceRoot = path.join(process.cwd(), `test-workspace-${randomUUID()}`);
    await fs.mkdir(workspaceRoot, { recursive: true });
    
    dbPath = path.join(workspaceRoot, 'test.db');
    db = new DatabaseService({ path: dbPath });
    
    storage = new StorageService({ workspaceRoot }, db);
  });

  afterEach(async () => {
    db.close();
    try {
      if (existsSync(workspaceRoot)) {
        await fs.rm(workspaceRoot, { recursive: true, force: true });
      }
    } catch (e) {
      console.error('Failed to cleanup workspace', e);
    }
  });

  describe('Property Tests', () => {
    it('Property 3: Directory structure follows consistent pattern', () => {
      // Validates: Requirements 5.1 (Task 4.2)
      fc.assert(
        fc.property(
          fc.record({
            platform: fc.constantFrom('leetcode', 'geeksforgeeks'),
            title: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            url: fc.webUrl(),
            difficulty: fc.constantFrom('Easy', 'Medium', 'Hard'),
            tags: fc.array(fc.string({ minLength: 1 })),
            topic: fc.stringOf(fc.constantFrom('a', 'b', 'c', '1', '2', '-', '_'), { minLength: 1 }),
            description: fc.string(),
            language: fc.constantFrom('python', 'javascript'),
            dateSolved: fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
            status: fc.constantFrom('solved', 'attempted', 'reviewed'),
          }),
          (metadata) => {
            const dirPath = storage.getProblemDirectory(metadata as ProblemMetadata);
            // It should start with workspace root
            expect(dirPath.startsWith(workspaceRoot)).toBe(true);
            
            // Extract the relative part
            const relativePath = path.relative(workspaceRoot, dirPath);
            const parts = relativePath.split(path.sep);
            
            // Must follow pattern problems/{platform}/{topic}/{sanitized-name}
            expect(parts[0]).toBe('problems');
            expect(parts[1]).toBe(metadata.platform);
            expect(parts[2]).toBe(metadata.topic);
            expect(parts[3]).toBeTruthy(); // sanitized name exists
            
            return true;
          }
        )
      );
    });

    it('Property 2: Template contains all required sections', () => {
      // Validates: Requirements 4.3, 4.5, 20.1, 20.2 (Task 4.8)
      fc.assert(
        fc.property(
          fc.record({
            platform: fc.constantFrom('leetcode', 'geeksforgeeks'),
            title: fc.string({ minLength: 1 }),
            url: fc.webUrl(),
            difficulty: fc.constantFrom('Easy', 'Medium', 'Hard'),
            tags: fc.array(fc.string()),
            topic: fc.stringOf(fc.constantFrom('a', 'b', 'c', '1', '2', '-', '_'), { minLength: 1 }),
            description: fc.string(),
            language: fc.string(),
            dateSolved: fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
            status: fc.constantFrom('solved', 'attempted', 'reviewed'),
          }),
          (metadata) => {
            const template = storage.generateNotesTemplate(metadata as ProblemMetadata);
            
            const requiredSections = [
              'Problem:',
              '## Approach',
              '## Complexity',
              '## Key Insight',
              '## Common Mistakes',
              '## Follow-up Problems',
            ];

            for (const section of requiredSections) {
              expect(template).toContain(section);
            }
            
            return true;
          }
        )
      );
    });

    it('Property 12: Metadata serialization preserves all data', () => {
      // Validates: Requirements 19.5 (Task 4.10)
      fc.assert(
        fc.property(
          fc.record({
            platform: fc.constantFrom('leetcode', 'geeksforgeeks'),
            title: fc.string({ minLength: 1 }),
            url: fc.webUrl(),
            difficulty: fc.constantFrom('Easy', 'Medium', 'Hard'),
            tags: fc.array(fc.string({ minLength: 1 })),
            topic: fc.stringOf(fc.constantFrom('a', 'b', 'c', '1', '2', '-', '_'), { minLength: 1 }),
            description: fc.string(),
            language: fc.string({ minLength: 1 }),
            dateSolved: fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
            status: fc.constantFrom('solved', 'attempted', 'reviewed'),
          }),
          (metadata) => {
            const jsonStr = storage.serializeMetadata(metadata as ProblemMetadata);
            const parsed = storage.deserializeMetadata(jsonStr);
            
            expect(parsed.platform).toBe(metadata.platform);
            expect(parsed.title).toBe(metadata.title);
            expect(parsed.url).toBe(metadata.url);
            expect(parsed.difficulty).toBe(metadata.difficulty);
            expect(parsed.tags).toEqual(metadata.tags);
            expect(parsed.topic).toBe(metadata.topic);
            expect(parsed.description).toBe(metadata.description);
            expect(parsed.language).toBe(metadata.language);
            expect(parsed.dateSolved.getTime()).toBe(metadata.dateSolved.getTime());
            expect(parsed.status).toBe(metadata.status);
            
            return true;
          }
        )
      );
    });
  });
});
