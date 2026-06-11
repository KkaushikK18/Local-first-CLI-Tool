import { DatabaseService } from '../database/DatabaseService.js';
import { SpacedRepetitionService } from './SpacedRepetitionService.js';
import {
  type ProblemEntry,
  type ReviewStats,
  type ReviewOutcome,
  type DSAVaultError,
  createDatabaseError,
} from '../types/index.js';
import { randomUUID } from 'crypto';

export interface RevisionFilters {
  due?: boolean;
  weak?: boolean;
  platform?: string;
  topic?: string;
  difficulty?: string;
}

export class RevisionEngine {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * 9.7 Implement getDueProblems with filtering
   */
  getDueProblems(filters: RevisionFilters = {}): ProblemEntry[] {
    try {
      const today = new Date();
      
      const dbFilters: any = {};
      if (filters.platform) dbFilters.platform = filters.platform;
      if (filters.topic) dbFilters.topic = filters.topic;
      if (filters.difficulty) dbFilters.difficulty = filters.difficulty;
      if (filters.weak) dbFilters.confidenceScore = 'weak';

      let problems = filters.due === false 
        ? this.db.getProblems(dbFilters)
        : this.db.getDueProblems(dbFilters);
        
      // Reconstruct ProblemEntry from DB records
      return problems.map(p => {
        // Find review stats
        const reviewRecord = this.db.findReviewByProblemId(p.id);
        
        return {
          id: p.id,
          metadata: {
            platform: p.platform as any,
            title: p.title,
            url: p.url,
            difficulty: p.difficulty as any,
            tags: JSON.parse(p.tags),
            topic: p.topic,
            description: '',
            language: p.language,
            dateSolved: new Date(p.date_solved),
            status: p.status as any,
            hint: p.hint || undefined,
          },
          // Notes and solution would need to be loaded from file system if needed
          // For revision engine, we mainly need metadata and stats
          notes: '', 
          solution: { code: '', language: p.language, languageExtension: '' },
          filePath: p.file_path,
          reviewStats: reviewRecord ? {
            firstSolvedDate: new Date(reviewRecord.first_solved_date),
            lastReviewedDate: reviewRecord.last_reviewed_date ? new Date(reviewRecord.last_reviewed_date) : null,
            nextReviewDate: new Date(reviewRecord.next_review_date),
            reviewCount: reviewRecord.review_count,
            confidenceScore: reviewRecord.confidence_score as any,
            mistakeCount: reviewRecord.mistake_count,
            easeFactor: reviewRecord.ease_factor,
            currentInterval: reviewRecord.current_interval,
          } : SpacedRepetitionService.initializeReviewStats(new Date(p.date_solved))
        };
      });
    } catch (error) {
      throw createDatabaseError(
        'Failed to fetch due problems',
        'query',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 9.7 Implement recordReview to update database with new stats
   */
  recordReview(problemId: string, outcome: ReviewOutcome): ReviewStats {
    try {
      const reviewRecord = this.db.findReviewByProblemId(problemId);
      if (!reviewRecord) {
        throw new Error(`Review record not found for problem ${problemId}`);
      }

      const currentStats: ReviewStats = {
        firstSolvedDate: new Date(reviewRecord.first_solved_date),
        lastReviewedDate: reviewRecord.last_reviewed_date ? new Date(reviewRecord.last_reviewed_date) : null,
        nextReviewDate: new Date(reviewRecord.next_review_date),
        reviewCount: reviewRecord.review_count,
        confidenceScore: reviewRecord.confidence_score as any,
        mistakeCount: reviewRecord.mistake_count,
        easeFactor: reviewRecord.ease_factor,
        currentInterval: reviewRecord.current_interval,
      };

      // 1. Calculate next interval and ease factor
      const { nextInterval, newEaseFactor } = SpacedRepetitionService.calculateNextInterval(
        currentStats.currentInterval,
        currentStats.easeFactor,
        outcome
      );

      // 2. Update stats
      const newReviewCount = currentStats.reviewCount + 1;
      const newMistakeCount = currentStats.mistakeCount + (outcome === 'failed' || outcome === 'hard' ? 1 : 0);
      const lastReviewedDate = new Date();
      
      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);

      // 3. Save to history first to get latest history for confidence calc
      this.db.transaction(() => {
        this.db.insertReviewHistory(
          randomUUID(),
          problemId,
          lastReviewedDate,
          outcome,
          currentStats.currentInterval,
          nextInterval
        );

        // Fetch history to calculate new confidence score
        const historyRecords = this.db.getReviewHistory(problemId);
        const mappedHistory = historyRecords.map(h => ({
          id: h.id,
          problemId: h.problem_id,
          reviewDate: new Date(h.review_date),
          outcome: h.outcome as ReviewOutcome,
          intervalBefore: h.interval_before,
          intervalAfter: h.interval_after
        }));

        const newConfidenceScore = SpacedRepetitionService.calculateConfidence(
          newReviewCount,
          newMistakeCount,
          mappedHistory
        );

        const updatedStats: ReviewStats = {
          ...currentStats,
          lastReviewedDate,
          nextReviewDate,
          reviewCount: newReviewCount,
          mistakeCount: newMistakeCount,
          easeFactor: newEaseFactor,
          currentInterval: nextInterval,
          confidenceScore: newConfidenceScore
        };

        // Update database
        this.db.updateReviewStats(problemId, updatedStats);
      });

      // Fetch the updated stats to return
      const updatedRecord = this.db.findReviewByProblemId(problemId)!;
      return {
        firstSolvedDate: new Date(updatedRecord.first_solved_date),
        lastReviewedDate: new Date(updatedRecord.last_reviewed_date!),
        nextReviewDate: new Date(updatedRecord.next_review_date),
        reviewCount: updatedRecord.review_count,
        confidenceScore: updatedRecord.confidence_score as any,
        mistakeCount: updatedRecord.mistake_count,
        easeFactor: updatedRecord.ease_factor,
        currentInterval: updatedRecord.current_interval,
      };

    } catch (error) {
      throw createDatabaseError(
        `Failed to record review for problem ${problemId}`,
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }
}
