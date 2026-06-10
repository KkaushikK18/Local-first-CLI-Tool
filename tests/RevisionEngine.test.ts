import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { RevisionEngine } from '../src/services/RevisionEngine.js';
import { DatabaseService } from '../src/database/DatabaseService.js';
import { type ReviewOutcome } from '../src/types/index.js';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

describe('RevisionEngine Property Tests', () => {
  let db: DatabaseService;
  let engine: RevisionEngine;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(process.cwd(), `test-${randomUUID()}.db`);
    db = new DatabaseService({ path: dbPath });
    engine = new RevisionEngine(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  it('Property 11: Review updates maintain correct state', () => {
    // Validates: Requirements 8.8 (Task 9.8)
    fc.assert(
      fc.property(
        fc.constantFrom('easy', 'medium', 'hard', 'failed'),
        (outcomeRaw) => {
          const outcome = outcomeRaw as ReviewOutcome;
          const problemId = randomUUID();
          const reviewId = randomUUID();

          // Setup initial state in DB
          db.insertProblem(
            problemId,
            'leetcode',
            'Test Problem',
            `https://leetcode.com/problems/test-${randomUUID()}/`,
            'Medium',
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

          // Perform review
          const beforeTime = new Date().getTime();
          const newStats = engine.recordReview(problemId, outcome);
          const afterTime = new Date().getTime();

          // Verify state
          expect(newStats.reviewCount).toBe(1);
          expect(newStats.lastReviewedDate?.getTime()).toBeGreaterThanOrEqual(beforeTime);
          expect(newStats.lastReviewedDate?.getTime()).toBeLessThanOrEqual(afterTime);

          if (outcome === 'failed' || outcome === 'hard') {
            expect(newStats.mistakeCount).toBe(1);
          } else {
            expect(newStats.mistakeCount).toBe(0);
          }

          const history = db.getReviewHistory(problemId);
          expect(history.length).toBe(1);
          expect(history[0].outcome).toBe(outcome);

          // Clean up for next iteration (since DB is reused across fast-check iterations within this test block)
          // Actually, we inserted a unique problem, so it's fine.
          return true;
        }
      ),
      { numRuns: 20 } // Reduced runs since DB operations are slow
    );
  });
});
