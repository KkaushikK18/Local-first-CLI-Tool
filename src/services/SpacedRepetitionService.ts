import {
  type ReviewStats,
  type ReviewOutcome,
  type ConfidenceLevel,
  type ReviewHistory,
} from '../types/index.js';

export class SpacedRepetitionService {
  /**
   * 9.1 Implement interval calculation algorithm (modified SM-2)
   */
  static calculateNextInterval(
    currentInterval: number,
    easeFactor: number,
    outcome: ReviewOutcome
  ): { nextInterval: number; newEaseFactor: number } {
    let nextInterval: number;
    
    // Map outcome to Quality (q) from 0 to 5
    let q: number;
    switch (outcome) {
      case 'easy': q = 5; break;
      case 'medium': q = 4; break;
      case 'hard': q = 3; break;
      case 'failed': q = 1; break;
      default: q = 0;
    }

    // Calculate new Ease Factor
    // Formula: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    let newEaseFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    
    // Clamp ease factor to minimum 1.3
    newEaseFactor = Math.max(1.3, newEaseFactor);

    if (q < 3) {
      // Failed or hard fail: reset interval to 1 day
      nextInterval = 1;
    } else {
      if (currentInterval <= 1) {
        nextInterval = 6;
      } else {
        nextInterval = Math.round(currentInterval * newEaseFactor);
      }
    }

    // Cap maximum interval at 365 days (1 year)
    nextInterval = Math.min(Math.max(nextInterval, 1), 365);
    
    return { nextInterval, newEaseFactor };
  }

  /**
   * 9.3 Implement confidence score calculation
   */
  static calculateConfidence(
    reviewCount: number,
    mistakeCount: number,
    history: { reviewDate: Date; outcome: ReviewOutcome }[]
  ): ConfidenceLevel {
    // Return 'weak' if review_count < 3 OR mistake_count > 2
    if (reviewCount < 3 || mistakeCount > 2) {
      return 'weak';
    }

    // Return 'strong' if review_count >= 5 AND last 3 reviews include 2+ 'easy'
    if (reviewCount >= 5 && history.length >= 3) {
      // Sort history by date descending to get latest
      const sortedHistory = [...history].sort(
        (a, b) => b.reviewDate.getTime() - a.reviewDate.getTime()
      );
      
      const last3 = sortedHistory.slice(0, 3);
      const easyCount = last3.filter(h => h.outcome === 'easy').length;
      
      if (easyCount >= 2) {
        return 'strong';
      }
    }

    // Return 'medium' otherwise
    return 'medium';
  }

  /**
   * 9.5 Implement review initialization for new problems
   */
  static initializeReviewStats(dateSolved: Date): ReviewStats {
    const firstSolvedDate = new Date(dateSolved);
    const nextReviewDate = new Date(dateSolved);
    nextReviewDate.setDate(nextReviewDate.getDate() + 1);

    return {
      firstSolvedDate,
      lastReviewedDate: null,
      nextReviewDate,
      reviewCount: 0,
      confidenceScore: 'weak',
      mistakeCount: 0,
      easeFactor: 2.5,
      currentInterval: 1.0,
    };
  }
}
