/**
 * Unit tests for DatabaseService
 * Validates: Requirements 6.1, 6.2, 6.3, 6.5, 6.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../src/database/DatabaseService.js';
import { ConfidenceLevel, ReviewOutcome } from '../src/types/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import fc from 'fast-check';

describe('DatabaseService', () => {
  let db: DatabaseService;
  let dbPath: string;

  beforeEach(() => {
    // Create a temporary database for each test
    dbPath = path.join(process.cwd(), `test-${randomUUID()}.db`);
    db = new DatabaseService({ path: dbPath });
  });

  afterEach(() => {
    // Clean up: close database and delete file
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // Also clean up WAL files
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  describe('Schema and Initialization', () => {
    it('should create all required tables', () => {
      const rawDb = db.getRawDatabase();
      
      // Check that all tables exist
      const tables = rawDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[];
      
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('problems');
      expect(tableNames).toContain('reviews');
      expect(tableNames).toContain('review_history');
      expect(tableNames).toContain('config');
    });

    it('should enable WAL mode', () => {
      const rawDb = db.getRawDatabase();
      const result = rawDb.pragma('journal_mode', { simple: true });
      expect(result).toBe('wal');
    });

    it('should enable foreign key constraints', () => {
      const rawDb = db.getRawDatabase();
      const result = rawDb.pragma('foreign_keys', { simple: true });
      expect(result).toBe(1);
    });

    it('should create all required indexes', () => {
      const rawDb = db.getRawDatabase();
      
      const indexes = rawDb
        .prepare("SELECT name FROM sqlite_master WHERE type='index'")
        .all() as { name: string }[];
      
      const indexNames = indexes.map(i => i.name);
      expect(indexNames).toContain('idx_problems_platform');
      expect(indexNames).toContain('idx_problems_topic');
      expect(indexNames).toContain('idx_problems_difficulty');
      expect(indexNames).toContain('idx_problems_date_solved');
      expect(indexNames).toContain('idx_reviews_next_review_date');
      expect(indexNames).toContain('idx_reviews_confidence_score');
      expect(indexNames).toContain('idx_review_history_problem_date');
    });
  });

  describe('Problem Operations', () => {
    it('should insert a problem record', () => {
      const problemId = randomUUID();
      const dateSolved = new Date('2024-01-15');

      const result = db.insertProblem(
        problemId,
        'leetcode',
        'Two Sum',
        'https://leetcode.com/problems/two-sum/',
        'Easy',
        ['array', 'hash-table'],
        'arrays',
        'python',
        dateSolved,
        'solved',
        '/problems/leetcode/arrays/two-sum'
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(problemId);
      expect(result.title).toBe('Two Sum');
      expect(result.platform).toBe('leetcode');
      expect(result.difficulty).toBe('Easy');
      expect(result.topic).toBe('arrays');
    });

    it('should find problem by URL', () => {
      const problemId = randomUUID();
      const url = 'https://leetcode.com/problems/two-sum/';

      db.insertProblem(
        problemId,
        'leetcode',
        'Two Sum',
        url,
        'Easy',
        ['array', 'hash-table'],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/problems/leetcode/arrays/two-sum'
      );

      const found = db.findProblemByUrl(url);
      expect(found).toBeDefined();
      expect(found?.id).toBe(problemId);
      expect(found?.url).toBe(url);
    });

    it('should find problem by ID', () => {
      const problemId = randomUUID();

      db.insertProblem(
        problemId,
        'leetcode',
        'Two Sum',
        'https://leetcode.com/problems/two-sum/',
        'Easy',
        ['array'],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/problems/leetcode/arrays/two-sum'
      );

      const found = db.findProblemById(problemId);
      expect(found).toBeDefined();
      expect(found?.id).toBe(problemId);
    });

    it('should update existing problem on URL conflict (upsert)', () => {
      const problemId1 = randomUUID();
      const problemId2 = randomUUID();
      const url = 'https://leetcode.com/problems/two-sum/';

      // Insert first problem
      db.insertProblem(
        problemId1,
        'leetcode',
        'Two Sum',
        url,
        'Easy',
        ['array'],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/problems/leetcode/arrays/two-sum'
      );

      // Insert second problem with same URL (should update)
      db.insertProblem(
        problemId2,
        'leetcode',
        'Two Sum Updated',
        url,
        'Medium',
        ['array', 'hash-table'],
        'arrays',
        'javascript',
        new Date(),
        'reviewed',
        '/problems/leetcode/arrays/two-sum-v2'
      );

      const found = db.findProblemByUrl(url);
      expect(found).toBeDefined();
      expect(found?.title).toBe('Two Sum Updated');
      expect(found?.difficulty).toBe('Medium');
      
      // Should only have one record
      const allProblems = db.getProblems();
      expect(allProblems.length).toBe(1);
    });

    it('should serialize and deserialize tags as JSON', () => {
      const problemId = randomUUID();
      const tags = ['array', 'hash-table', 'two-pointer'];

      db.insertProblem(
        problemId,
        'leetcode',
        'Three Sum',
        'https://leetcode.com/problems/three-sum/',
        'Medium',
        tags,
        'arrays',
        'python',
        new Date(),
        'solved',
        '/problems/leetcode/arrays/three-sum'
      );

      const found = db.findProblemById(problemId);
      expect(found).toBeDefined();
      expect(JSON.parse(found!.tags)).toEqual(tags);
    });

    it('should filter problems by platform', () => {
      db.insertProblem(
        randomUUID(),
        'leetcode',
        'Problem 1',
        'https://leetcode.com/problems/problem-1/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path1'
      );

      db.insertProblem(
        randomUUID(),
        'geeksforgeeks',
        'Problem 2',
        'https://www.geeksforgeeks.org/problems/problem-2/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path2'
      );

      const leetcodeProblems = db.getProblems({ platform: 'leetcode' });
      expect(leetcodeProblems.length).toBe(1);
      expect(leetcodeProblems[0].platform).toBe('leetcode');
    });

    it('should filter problems by topic', () => {
      db.insertProblem(
        randomUUID(),
        'leetcode',
        'Problem 1',
        'https://leetcode.com/problems/problem-1/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path1'
      );

      db.insertProblem(
        randomUUID(),
        'leetcode',
        'Problem 2',
        'https://leetcode.com/problems/problem-2/',
        'Easy',
        [],
        'trees',
        'python',
        new Date(),
        'solved',
        '/path2'
      );

      const arrayProblems = db.getProblems({ topic: 'arrays' });
      expect(arrayProblems.length).toBe(1);
      expect(arrayProblems[0].topic).toBe('arrays');
    });

    it('should filter problems by difficulty', () => {
      db.insertProblem(
        randomUUID(),
        'leetcode',
        'Problem 1',
        'https://leetcode.com/problems/problem-1/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path1'
      );

      db.insertProblem(
        randomUUID(),
        'leetcode',
        'Problem 2',
        'https://leetcode.com/problems/problem-2/',
        'Hard',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path2'
      );

      const hardProblems = db.getProblems({ difficulty: 'Hard' });
      expect(hardProblems.length).toBe(1);
      expect(hardProblems[0].difficulty).toBe('Hard');
    });
  });

  describe('Review Operations', () => {
    it('should insert review record with initial stats', () => {
      const problemId = randomUUID();
      const reviewId = randomUUID();
      const firstSolvedDate = new Date('2024-01-15');
      const nextReviewDate = new Date('2024-01-16');

      // Insert problem first (foreign key constraint)
      db.insertProblem(
        problemId,
        'leetcode',
        'Test Problem',
        'https://leetcode.com/problems/test-problem/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path'
      );

      const result = db.insertReview(reviewId, problemId, {
        firstSolvedDate,
        lastReviewedDate: null,
        nextReviewDate,
        reviewCount: 0,
        confidenceScore: 'weak',
        mistakeCount: 0,
        easeFactor: 2.5,
        currentInterval: 1.0,
      });

      expect(result).toBeDefined();
      expect(result.problem_id).toBe(problemId);
      expect(result.review_count).toBe(0);
      expect(result.confidence_score).toBe('weak');
      expect(result.ease_factor).toBe(2.5);
      expect(result.current_interval).toBe(1.0);
    });

    it('should find review by problem ID', () => {
      const problemId = randomUUID();
      const reviewId = randomUUID();

      // Insert problem first
      db.insertProblem(
        problemId,
        'leetcode',
        'Test Problem',
        'https://leetcode.com/problems/test-problem-2/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path'
      );

      db.insertReview(reviewId, problemId, {
        firstSolvedDate: new Date(),
        lastReviewedDate: null,
        nextReviewDate: new Date(),
        reviewCount: 0,
        confidenceScore: 'weak',
        mistakeCount: 0,
        easeFactor: 2.5,
        currentInterval: 1.0,
      });

      const found = db.findReviewByProblemId(problemId);
      expect(found).toBeDefined();
      expect(found?.problem_id).toBe(problemId);
    });

    it('should update review statistics', () => {
      const problemId = randomUUID();
      const reviewId = randomUUID();

      // Insert problem first
      db.insertProblem(
        problemId,
        'leetcode',
        'Test Problem',
        'https://leetcode.com/problems/test-problem-3/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path'
      );

      db.insertReview(reviewId, problemId, {
        firstSolvedDate: new Date('2024-01-15'),
        lastReviewedDate: null,
        nextReviewDate: new Date('2024-01-16'),
        reviewCount: 0,
        confidenceScore: 'weak',
        mistakeCount: 0,
        easeFactor: 2.5,
        currentInterval: 1.0,
      });

      // Update stats after a review
      db.updateReviewStats(problemId, {
        firstSolvedDate: new Date('2024-01-15'),
        lastReviewedDate: new Date('2024-01-16'),
        nextReviewDate: new Date('2024-01-18'),
        reviewCount: 1,
        confidenceScore: 'medium',
        mistakeCount: 0,
        easeFactor: 2.65,
        currentInterval: 2.5,
      });

      const updated = db.findReviewByProblemId(problemId);
      expect(updated?.review_count).toBe(1);
      expect(updated?.confidence_score).toBe('medium');
      expect(updated?.ease_factor).toBe(2.65);
      expect(updated?.current_interval).toBe(2.5);
    });

    it('should get due problems based on next review date', () => {
      const problemId1 = randomUUID();
      const problemId2 = randomUUID();
      const url1 = 'https://leetcode.com/problems/due-problem-1/';
      const url2 = 'https://leetcode.com/problems/due-problem-2/';

      // Insert problems
      db.insertProblem(
        problemId1,
        'leetcode',
        'Problem 1',
        url1,
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path1'
      );

      db.insertProblem(
        problemId2,
        'leetcode',
        'Problem 2',
        url2,
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path2'
      );

      // Insert reviews - one due, one not due
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      db.insertReview(randomUUID(), problemId1, {
        firstSolvedDate: new Date(),
        lastReviewedDate: null,
        nextReviewDate: yesterday, // Due
        reviewCount: 0,
        confidenceScore: 'weak',
        mistakeCount: 0,
        easeFactor: 2.5,
        currentInterval: 1.0,
      });

      db.insertReview(randomUUID(), problemId2, {
        firstSolvedDate: new Date(),
        lastReviewedDate: null,
        nextReviewDate: tomorrow, // Not due
        reviewCount: 0,
        confidenceScore: 'weak',
        mistakeCount: 0,
        easeFactor: 2.5,
        currentInterval: 1.0,
      });

      const dueProblems = db.getDueProblems();
      expect(dueProblems.length).toBe(1);
      // Use URL to verify correct problem since upsert may affect ID
      expect(dueProblems[0].url).toBe(url1);
    });

    it('should filter due problems by confidence score', () => {
      const problemId1 = randomUUID();
      const problemId2 = randomUUID();

      db.insertProblem(
        problemId1,
        'leetcode',
        'Problem 1',
        'https://leetcode.com/problems/problem-1/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path1'
      );

      db.insertProblem(
        problemId2,
        'leetcode',
        'Problem 2',
        'https://leetcode.com/problems/problem-2/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path2'
      );

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      db.insertReview(randomUUID(), problemId1, {
        firstSolvedDate: new Date(),
        lastReviewedDate: null,
        nextReviewDate: yesterday,
        reviewCount: 0,
        confidenceScore: 'weak',
        mistakeCount: 0,
        easeFactor: 2.5,
        currentInterval: 1.0,
      });

      db.insertReview(randomUUID(), problemId2, {
        firstSolvedDate: new Date(),
        lastReviewedDate: null,
        nextReviewDate: yesterday,
        reviewCount: 5,
        confidenceScore: 'strong',
        mistakeCount: 0,
        easeFactor: 2.5,
        currentInterval: 1.0,
      });

      const weakProblems = db.getDueProblems({ confidenceScore: 'weak' });
      expect(weakProblems.length).toBe(1);
      expect(weakProblems[0].confidence_score).toBe('weak');
    });
  });

  describe('Review History Operations', () => {
    it('should insert review history entry', () => {
      const problemId = randomUUID();
      const historyId = randomUUID();
      const reviewDate = new Date();

      // Insert problem first
      db.insertProblem(
        problemId,
        'leetcode',
        'Test Problem',
        'https://leetcode.com/problems/history-test-1/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path'
      );

      db.insertReviewHistory(
        historyId,
        problemId,
        reviewDate,
        'easy',
        1.0,
        2.5
      );

      const history = db.getReviewHistory(problemId);
      expect(history.length).toBe(1);
      expect(history[0].outcome).toBe('easy');
      expect(history[0].interval_before).toBe(1.0);
      expect(history[0].interval_after).toBe(2.5);
    });

    it('should retrieve review history for a problem', () => {
      const problemId = randomUUID();

      // Insert problem first
      db.insertProblem(
        problemId,
        'leetcode',
        'Test Problem',
        'https://leetcode.com/problems/history-test-2/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path'
      );

      // Insert multiple history entries
      db.insertReviewHistory(
        randomUUID(),
        problemId,
        new Date('2024-01-15'),
        'easy',
        1.0,
        2.5
      );

      db.insertReviewHistory(
        randomUUID(),
        problemId,
        new Date('2024-01-18'),
        'medium',
        2.5,
        3.75
      );

      db.insertReviewHistory(
        randomUUID(),
        problemId,
        new Date('2024-01-22'),
        'easy',
        3.75,
        9.375
      );

      const history = db.getReviewHistory(problemId);
      expect(history.length).toBe(3);
      
      // Should be ordered by date descending (most recent first)
      expect(new Date(history[0].review_date).getTime()).toBeGreaterThan(
        new Date(history[1].review_date).getTime()
      );
    });

    it('should limit review history results', () => {
      const problemId = randomUUID();

      // Insert problem first
      db.insertProblem(
        problemId,
        'leetcode',
        'Test Problem',
        'https://leetcode.com/problems/history-test-3/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path'
      );

      for (let i = 0; i < 10; i++) {
        db.insertReviewHistory(
          randomUUID(),
          problemId,
          new Date(),
          'easy',
          1.0,
          2.5
        );
      }

      const history = db.getReviewHistory(problemId, 5);
      expect(history.length).toBe(5);
    });
  });

  describe('Configuration Operations', () => {
    it('should set and get config values', () => {
      db.setConfig('test_key', 'test_value');

      const value = db.getConfig('test_key');
      expect(value).toBe('test_value');
    });

    it('should update existing config values', () => {
      db.setConfig('test_key', 'initial_value');
      db.setConfig('test_key', 'updated_value');

      const value = db.getConfig('test_key');
      expect(value).toBe('updated_value');
    });

    it('should return undefined for non-existent config keys', () => {
      const value = db.getConfig('non_existent_key');
      expect(value).toBeUndefined();
    });
  });

  describe('Transaction Support', () => {
    it('should execute operations within a transaction', () => {
      const problemId = randomUUID();
      const reviewId = randomUUID();

      db.transaction(() => {
        db.insertProblem(
          problemId,
          'leetcode',
          'Transaction Test',
          'https://leetcode.com/problems/transaction-test/',
          'Easy',
          [],
          'arrays',
          'python',
          new Date(),
          'solved',
          '/path'
        );

        db.insertReview(reviewId, problemId, {
          firstSolvedDate: new Date(),
          lastReviewedDate: null,
          nextReviewDate: new Date(),
          reviewCount: 0,
          confidenceScore: 'weak',
          mistakeCount: 0,
          easeFactor: 2.5,
          currentInterval: 1.0,
        });
      });

      const problem = db.findProblemById(problemId);
      const review = db.findReviewByProblemId(problemId);

      expect(problem).toBeDefined();
      expect(review).toBeDefined();
    });

    it('should rollback transaction on error', () => {
      const problemId = randomUUID();

      try {
        db.transaction(() => {
          db.insertProblem(
            problemId,
            'leetcode',
            'Rollback Test',
            'https://leetcode.com/problems/rollback-test/',
            'Easy',
            [],
            'arrays',
            'python',
            new Date(),
            'solved',
            '/path'
          );

          // Force an error
          throw new Error('Intentional error');
        });
      } catch (error) {
        // Expected to throw
      }

      // Problem should not be in database
      const problem = db.findProblemById(problemId);
      expect(problem).toBeUndefined();
    });
  });

  describe('Statistics', () => {
    it('should return database statistics', () => {
      // Insert test data
      db.insertProblem(
        randomUUID(),
        'leetcode',
        'Problem 1',
        'https://leetcode.com/problems/problem-1/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path1'
      );

      db.insertProblem(
        randomUUID(),
        'geeksforgeeks',
        'Problem 2',
        'https://www.geeksforgeeks.org/problems/problem-2/',
        'Hard',
        [],
        'trees',
        'python',
        new Date(),
        'solved',
        '/path2'
      );

      const stats = db.getStats();

      expect(stats.totalProblems).toBe(2);
      expect(stats.byPlatform['leetcode']).toBe(1);
      expect(stats.byPlatform['geeksforgeeks']).toBe(1);
      expect(stats.byDifficulty['Easy']).toBe(1);
      expect(stats.byDifficulty['Hard']).toBe(1);
      expect(stats.byTopic['arrays']).toBe(1);
      expect(stats.byTopic['trees']).toBe(1);
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should enforce foreign key constraint on reviews table', () => {
      const nonExistentProblemId = randomUUID();
      const reviewId = randomUUID();

      expect(() => {
        db.insertReview(reviewId, nonExistentProblemId, {
          firstSolvedDate: new Date(),
          lastReviewedDate: null,
          nextReviewDate: new Date(),
          reviewCount: 0,
          confidenceScore: 'weak',
          mistakeCount: 0,
          easeFactor: 2.5,
          currentInterval: 1.0,
        });
      }).toThrow();
    });

    it('should cascade delete reviews when problem is deleted', () => {
      const problemId = randomUUID();
      const reviewId = randomUUID();

      // Insert problem and review
      db.insertProblem(
        problemId,
        'leetcode',
        'Cascade Test',
        'https://leetcode.com/problems/cascade-test/',
        'Easy',
        [],
        'arrays',
        'python',
        new Date(),
        'solved',
        '/path'
      );

      db.insertReview(reviewId, problemId, {
        firstSolvedDate: new Date(),
        lastReviewedDate: null,
        nextReviewDate: new Date(),
        reviewCount: 0,
        confidenceScore: 'weak',
        mistakeCount: 0,
        easeFactor: 2.5,
        currentInterval: 1.0,
      });

      // Delete problem
      const rawDb = db.getRawDatabase();
      rawDb.prepare('DELETE FROM problems WHERE id = ?').run(problemId);

      // Review should also be deleted
      const review = db.findReviewByProblemId(problemId);
      expect(review).toBeUndefined();
    });
  });

  describe('Property-Based Tests', () => {
    it('Property 6: Database records match in-memory representation', () => {
      // Validates: Requirements 6.1
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            platform: fc.constantFrom('leetcode', 'geeksforgeeks'),
            title: fc.string({ minLength: 1 }),
            url: fc.webUrl(),
            difficulty: fc.constantFrom('Easy', 'Medium', 'Hard'),
            tags: fc.array(fc.string({ minLength: 1 })),
            topic: fc.string({ minLength: 1 }),
            language: fc.constantFrom('python', 'javascript', 'cpp', 'java'),
            dateSolved: fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
            status: fc.constantFrom('solved', 'attempted', 'reviewed'),
            filePath: fc.string({ minLength: 1 }),
          }),
          (problem) => {
            // Test in a transaction so we can rollback and keep DB clean
            db.transaction(() => {
              db.insertProblem(
                problem.id,
                problem.platform,
                problem.title,
                problem.url,
                problem.difficulty,
                problem.tags,
                problem.topic,
                problem.language,
                problem.dateSolved,
                problem.status,
                problem.filePath
              );

              const found = db.findProblemByUrl(problem.url);
              expect(found).toBeDefined();
              expect(found!.title).toBe(problem.title);
              expect(found!.platform).toBe(problem.platform);
              expect(found!.difficulty).toBe(problem.difficulty);
              expect(JSON.parse(found!.tags)).toEqual(problem.tags);
              expect(found!.topic).toBe(problem.topic);
              expect(found!.language).toBe(problem.language);
              expect(found!.status).toBe(problem.status);
              expect(found!.file_path).toBe(problem.filePath);
              // Clean up manually for the next property iteration
              db.getRawDatabase().prepare('DELETE FROM problems WHERE id = ?').run(problem.id);
            });
            return true;
          }
        )
      );
    });

    it('Property 8: Duplicate URLs result in single record (upsert idempotency)', () => {
      // Validates: Requirements 6.3
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            platform: fc.constantFrom('leetcode', 'geeksforgeeks'),
            title: fc.string({ minLength: 1 }),
            url: fc.webUrl(),
            difficulty: fc.constantFrom('Easy', 'Medium', 'Hard'),
            tags: fc.array(fc.string({ minLength: 1 })),
            topic: fc.string({ minLength: 1 }),
            language: fc.constantFrom('python', 'javascript', 'cpp', 'java'),
            dateSolved: fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
            status: fc.constantFrom('solved', 'attempted', 'reviewed'),
            filePath: fc.string({ minLength: 1 }),
          }),
          (problem) => {
            db.transaction(() => {
              // Insert once
              db.insertProblem(
                problem.id,
                problem.platform,
                problem.title,
                problem.url,
                problem.difficulty,
                problem.tags,
                problem.topic,
                problem.language,
                problem.dateSolved,
                problem.status,
                problem.filePath
              );

              // Insert second time with same URL but different ID and maybe updated title
              const newId = randomUUID();
              db.insertProblem(
                newId,
                problem.platform,
                problem.title + ' Updated',
                problem.url,
                problem.difficulty,
                problem.tags,
                problem.topic,
                problem.language,
                problem.dateSolved,
                problem.status,
                problem.filePath
              );

              const allProblems = db.getProblems();
              // In this test environment with isolated DBs, this specific URL should have exactly 1 record
              const urlProblems = allProblems.filter(p => p.url === problem.url);
              expect(urlProblems.length).toBe(1);
              
              // The title should be the updated one
              expect(urlProblems[0].title).toBe(problem.title + ' Updated');

              // Cleanup
              db.getRawDatabase().prepare('DELETE FROM problems WHERE url = ?').run(problem.url);
            });
            return true;
          }
        )
      );
    });
  });
});
