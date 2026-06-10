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
    let newEaseFactor = easeFactor;

    switch (outcome) {
      case 'easy':
        nextInterval = currentInterval * 2.5 * easeFactor;
        newEaseFactor += 0.15;
        break;
      case 'medium':
        nextInterval = currentInterval * 1.5 * easeFactor;
        newEaseFactor -= 0.05;
        break;
      case 'hard':
        nextInterval = currentInterval * 1.0;
        newEaseFactor -= 0.15;
        break;
      case 'failed':
        nextInterval = currentInterval * 1.0;
        newEaseFactor -= 0.20;
        break;
      default:
        nextInterval = currentInterval;
    }

    // Cap maximum interval at 180 days
    nextInterval = Math.min(Math.max(nextInterval, 1), 180);
    
    // Clamp ease factor between 1.3 and 3.0
    newEaseFactor = Math.min(Math.max(newEaseFactor, 1.3), 3.0);

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
