import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SpacedRepetitionService } from '../src/services/SpacedRepetitionService.js';
import { type ReviewHistory, type ReviewOutcome } from '../src/types/index.js';
import { randomUUID } from 'crypto';

describe('SpacedRepetitionService Property Tests', () => {
  it('Property 9: Interval calculation follows algorithm consistently', () => {
    // Validates: Requirements 8.2, 8.3, 8.4, 8.5 (Task 9.2)
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 180, noNaN: true }), // currentInterval
        fc.double({ min: 1.3, max: 3.0, noNaN: true }), // easeFactor
        fc.constantFrom('easy', 'medium', 'hard', 'failed'), // outcome
        (currentInterval, easeFactor, outcome) => {
          const { nextInterval, newEaseFactor } = SpacedRepetitionService.calculateNextInterval(
            currentInterval,
            easeFactor,
            outcome as ReviewOutcome
          );

          // Check maximum cap
          expect(nextInterval).toBeLessThanOrEqual(180);
          expect(nextInterval).toBeGreaterThanOrEqual(1);

          // Check ease factor clamping
          expect(newEaseFactor).toBeLessThanOrEqual(3.0);
          expect(newEaseFactor).toBeGreaterThanOrEqual(1.3);

          // Check specific logic
          if (nextInterval < 180) {
            // Note: because of capping, these checks only strictly hold if not capped
            if (outcome === 'easy') {
              expect(nextInterval).toBeCloseTo(currentInterval * 2.5 * easeFactor, 5);
            } else if (outcome === 'medium') {
              expect(nextInterval).toBeCloseTo(currentInterval * 1.5 * easeFactor, 5);
            } else if (outcome === 'hard' || outcome === 'failed') {
              expect(nextInterval).toBeCloseTo(currentInterval * 1.0, 5);
            }
          }

          if (newEaseFactor < 3.0 && newEaseFactor > 1.3) {
            if (outcome === 'easy') {
              expect(newEaseFactor).toBeCloseTo(easeFactor + 0.15, 5);
            } else if (outcome === 'medium') {
              expect(newEaseFactor).toBeCloseTo(easeFactor - 0.05, 5);
            } else if (outcome === 'hard') {
              expect(newEaseFactor).toBeCloseTo(easeFactor - 0.15, 5);
            } else if (outcome === 'failed') {
              expect(newEaseFactor).toBeCloseTo(easeFactor - 0.20, 5);
            }
          }

          return true;
        }
      )
    );
  });

  it('Property 10: Confidence score reflects mastery correctly', () => {
    // Validates: Requirements 8.6, 8.7 (Task 9.4)
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // reviewCount
        fc.integer({ min: 0, max: 100 }), // mistakeCount
        fc.array(
          fc.record({
            id: fc.uuid(),
            problemId: fc.uuid(),
            reviewDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
            outcome: fc.constantFrom('easy', 'medium', 'hard', 'failed'),
            intervalBefore: fc.double(),
            intervalAfter: fc.double(),
          })
        ), // history
        (reviewCount, mistakeCount, historyRaw) => {
          const history = historyRaw as ReviewHistory[];
          const score = SpacedRepetitionService.calculateConfidence(reviewCount, mistakeCount, history);

          if (reviewCount < 3 || mistakeCount > 2) {
            expect(score).toBe('weak');
          } else {
            // Check 'strong' condition
            const sortedHistory = [...history].sort(
              (a, b) => b.reviewDate.getTime() - a.reviewDate.getTime()
            );
            const last3 = sortedHistory.slice(0, 3);
            const easyCount = last3.filter(h => h.outcome === 'easy').length;

            if (reviewCount >= 5 && last3.length >= 3 && easyCount >= 2) {
              expect(score).toBe('strong');
            } else {
              expect(score).toBe('medium');
            }
          }

          return true;
        }
      )
    );
  });

  it('Property 7: Review initialization is correct for all dates', () => {
    // Validates: Requirements 6.2, 6.5, 6.6, 8.1 (Task 9.6)
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
        (dateSolved) => {
          const stats = SpacedRepetitionService.initializeReviewStats(dateSolved);

          expect(stats.firstSolvedDate.getTime()).toBe(dateSolved.getTime());
          expect(stats.lastReviewedDate).toBeNull();
          
          const expectedNextDate = new Date(dateSolved);
          expectedNextDate.setDate(expectedNextDate.getDate() + 1);
          expect(stats.nextReviewDate.getTime()).toBe(expectedNextDate.getTime());

          expect(stats.reviewCount).toBe(0);
          expect(stats.confidenceScore).toBe('weak');
          expect(stats.mistakeCount).toBe(0);
          expect(stats.easeFactor).toBe(2.5);
          expect(stats.currentInterval).toBe(1.0);

          return true;
        }
      )
    );
  });
});
