/**
 * DatabaseService - Manages SQLite database operations for DSA Vault
 * Implements schema creation, type-safe queries, and prepared statement helpers
 */

import Database from 'better-sqlite3';
import type { ReviewStats, ConfidenceLevel, ReviewOutcome } from '../types/index.js';

export interface DatabaseConfig {
  path: string;
}

export interface ProblemRow {
  id: string;
  platform: string;
  title: string;
  url: string;
  difficulty: string;
  tags: string; // JSON string
  topic: string;
  language: string;
  date_solved: string; // ISO 8601
  status: string;
  file_path: string;
  hint: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewRow {
  id: string;
  problem_id: string;
  first_solved_date: string; // ISO 8601
  last_reviewed_date: string | null; // ISO 8601
  next_review_date: string; // ISO 8601
  review_count: number;
  confidence_score: ConfidenceLevel;
  mistake_count: number;
  ease_factor: number;
  current_interval: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewHistoryRow {
  id: string;
  problem_id: string;
  review_date: string; // ISO 8601
  outcome: ReviewOutcome;
  interval_before: number;
  interval_after: number;
  created_at: string;
}

export interface ConfigRow {
  key: string;
  value: string;
  updated_at: string;
}

/**
 * DatabaseService provides type-safe access to the SQLite database
 * with prepared statement helpers for common queries.
 */
export class DatabaseService {
  private db: Database.Database;
  
  // Prepared statements for type-safe queries
  private statements: {
    insertProblem?: Database.Statement;
    updateProblem?: Database.Statement;
    insertReview?: Database.Statement;
    updateReview?: Database.Statement;
    insertReviewHistory?: Database.Statement;
    findProblemByUrl?: Database.Statement;
    findProblemById?: Database.Statement;
    findReviewByProblemId?: Database.Statement;
    setConfig?: Database.Statement;
    getConfig?: Database.Statement;
  } = {};

  constructor(config: DatabaseConfig) {
    this.db = new Database(config.path);
    this.initialize();
  }

  /**
   * Initialize the database: enable features, create schema, prepare statements
   */
  private initialize(): void {
    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');
    
    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');
    
    // Create schema
    this.createSchema();
    
    // Prepare commonly-used statements
    this.prepareStatements();
  }

  /**
   * Create all database tables and indexes
   */
  private createSchema(): void {
    // Problems table - stores problem metadata
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS problems (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL CHECK(platform IN ('leetcode', 'geeksforgeeks')),
        title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        difficulty TEXT NOT NULL CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
        tags TEXT NOT NULL,
        topic TEXT NOT NULL,
        language TEXT NOT NULL,
        date_solved TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('solved', 'attempted', 'reviewed')),
        file_path TEXT NOT NULL,
        hint TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Migration: Add hint column to existing problems table
    try {
      this.db.exec(`ALTER TABLE problems ADD COLUMN hint TEXT`);
    } catch (e) {
      // Ignore if column already exists
    }

    // Reviews table - stores spaced-repetition data
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        problem_id TEXT NOT NULL,
        first_solved_date TEXT NOT NULL,
        last_reviewed_date TEXT,
        next_review_date TEXT NOT NULL,
        review_count INTEGER NOT NULL DEFAULT 0,
        confidence_score TEXT NOT NULL DEFAULT 'weak' CHECK(confidence_score IN ('weak', 'medium', 'strong')),
        mistake_count INTEGER NOT NULL DEFAULT 0,
        ease_factor REAL NOT NULL DEFAULT 2.5,
        current_interval REAL NOT NULL DEFAULT 1.0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
      )
    `);

    // Review history table - tracks individual review sessions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS review_history (
        id TEXT PRIMARY KEY,
        problem_id TEXT NOT NULL,
        review_date TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK(outcome IN ('easy', 'medium', 'hard', 'failed')),
        interval_before REAL NOT NULL,
        interval_after REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
      )
    `);

    // Config table - stores application configuration
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create indexes for common queries
    this.createIndexes();
  }

  /**
   * Create indexes to optimize common query patterns
   */
  private createIndexes(): void {
    // Index for filtering by platform
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_problems_platform 
      ON problems(platform)
    `);

    // Index for filtering by topic
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_problems_topic 
      ON problems(topic)
    `);

    // Index for filtering by difficulty
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_problems_difficulty 
      ON problems(difficulty)
    `);

    // Index for sorting by date solved
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_problems_date_solved 
      ON problems(date_solved)
    `);

    // Index for finding due problems
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_reviews_next_review_date 
      ON reviews(next_review_date)
    `);

    // Index for filtering by confidence score
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_reviews_confidence_score 
      ON reviews(confidence_score)
    `);

    // Index for querying review history
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_review_history_problem_date 
      ON review_history(problem_id, review_date)
    `);
  }

  /**
   * Prepare commonly-used SQL statements for better performance
   */
  private prepareStatements(): void {
    // Insert problem (using UPSERT for idempotency)
    this.statements.insertProblem = this.db.prepare(`
      INSERT INTO problems (
        id, platform, title, url, difficulty, tags, topic, 
        language, date_solved, status, file_path, hint
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        difficulty = excluded.difficulty,
        tags = excluded.tags,
        topic = excluded.topic,
        language = excluded.language,
        status = excluded.status,
        file_path = excluded.file_path,
        hint = excluded.hint,
        updated_at = datetime('now')
      RETURNING *
    `);

    // Update problem
    this.statements.updateProblem = this.db.prepare(`
      UPDATE problems 
      SET title = ?, difficulty = ?, tags = ?, topic = ?, 
          language = ?, status = ?, file_path = ?, hint = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `);

    // Insert review record
    this.statements.insertReview = this.db.prepare(`
      INSERT INTO reviews (
        id, problem_id, first_solved_date, last_reviewed_date,
        next_review_date, review_count, confidence_score,
        mistake_count, ease_factor, current_interval
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        last_reviewed_date = excluded.last_reviewed_date,
        next_review_date = excluded.next_review_date,
        review_count = excluded.review_count,
        confidence_score = excluded.confidence_score,
        mistake_count = excluded.mistake_count,
        ease_factor = excluded.ease_factor,
        current_interval = excluded.current_interval,
        updated_at = datetime('now')
      RETURNING *
    `);

    // Update review stats
    this.statements.updateReview = this.db.prepare(`
      UPDATE reviews
      SET last_reviewed_date = ?,
          next_review_date = ?,
          review_count = ?,
          confidence_score = ?,
          mistake_count = ?,
          ease_factor = ?,
          current_interval = ?,
          updated_at = datetime('now')
      WHERE problem_id = ?
    `);

    // Insert review history entry
    this.statements.insertReviewHistory = this.db.prepare(`
      INSERT INTO review_history (
        id, problem_id, review_date, outcome,
        interval_before, interval_after
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Find problem by URL
    this.statements.findProblemByUrl = this.db.prepare(`
      SELECT * FROM problems WHERE url = ?
    `);

    // Find problem by ID
    this.statements.findProblemById = this.db.prepare(`
      SELECT * FROM problems WHERE id = ?
    `);

    // Find review by problem ID
    this.statements.findReviewByProblemId = this.db.prepare(`
      SELECT * FROM reviews WHERE problem_id = ?
    `);

    // Set config value
    this.statements.setConfig = this.db.prepare(`
      INSERT INTO config (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `);

    // Get config value
    this.statements.getConfig = this.db.prepare(`
      SELECT value FROM config WHERE key = ?
    `);
  }

  /**
   * Insert or update a problem record
   */
  insertProblem(
    id: string,
    platform: string,
    title: string,
    url: string,
    difficulty: string,
    tags: string[],
    topic: string,
    language: string,
    dateSolved: Date,
    status: string,
    filePath: string,
    hint?: string
  ): ProblemRow {
    const result = this.statements.insertProblem!.get(
      id,
      platform,
      title,
      url,
      difficulty,
      JSON.stringify(tags),
      topic,
      language,
      dateSolved.toISOString(),
      status,
      filePath,
      hint || null
    ) as ProblemRow;

    return result;
  }

  /**
   * Insert or update a review record
   */
  insertReview(
    id: string,
    problemId: string,
    stats: ReviewStats
  ): ReviewRow {
    const result = this.statements.insertReview!.get(
      id,
      problemId,
      stats.firstSolvedDate.toISOString(),
      stats.lastReviewedDate?.toISOString() || null,
      stats.nextReviewDate.toISOString(),
      stats.reviewCount,
      stats.confidenceScore,
      stats.mistakeCount,
      stats.easeFactor,
      stats.currentInterval
    ) as ReviewRow;

    return result;
  }

  /**
   * Update review statistics
   */
  updateReviewStats(problemId: string, stats: ReviewStats): void {
    this.statements.updateReview!.run(
      stats.lastReviewedDate?.toISOString() || null,
      stats.nextReviewDate.toISOString(),
      stats.reviewCount,
      stats.confidenceScore,
      stats.mistakeCount,
      stats.easeFactor,
      stats.currentInterval,
      problemId
    );
  }

  /**
   * Insert a review history entry
   */
  insertReviewHistory(
    id: string,
    problemId: string,
    reviewDate: Date,
    outcome: ReviewOutcome,
    intervalBefore: number,
    intervalAfter: number
  ): void {
    this.statements.insertReviewHistory!.run(
      id,
      problemId,
      reviewDate.toISOString(),
      outcome,
      intervalBefore,
      intervalAfter
    );
  }

  /**
   * Find a problem by URL
   */
  findProblemByUrl(url: string): ProblemRow | undefined {
    return this.statements.findProblemByUrl!.get(url) as ProblemRow | undefined;
  }

  /**
   * Find a problem by ID
   */
  findProblemById(id: string): ProblemRow | undefined {
    return this.statements.findProblemById!.get(id) as ProblemRow | undefined;
  }

  /**
   * Find review stats by problem ID
   */
  findReviewByProblemId(problemId: string): ReviewRow | undefined {
    return this.statements.findReviewByProblemId!.get(problemId) as ReviewRow | undefined;
  }

  /**
   * Get all problems with optional filtering
   */
  getProblems(filters?: {
    platform?: string;
    topic?: string;
    difficulty?: string;
  }): ProblemRow[] {
    let query = 'SELECT * FROM problems WHERE 1=1';
    const params: string[] = [];

    if (filters?.platform) {
      query += ' AND platform = ?';
      params.push(filters.platform);
    }

    if (filters?.topic) {
      query += ' AND topic = ?';
      params.push(filters.topic);
    }

    if (filters?.difficulty) {
      query += ' AND difficulty = ?';
      params.push(filters.difficulty);
    }

    query += ' ORDER BY date_solved DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as ProblemRow[];
  }

  /**
   * Get problems due for review
   */
  getDueProblems(filters?: {
    platform?: string;
    topic?: string;
    difficulty?: string;
    confidenceScore?: ConfidenceLevel;
  }): (ProblemRow & ReviewRow)[] {
    let query = `
      SELECT p.*, r.*
      FROM problems p
      INNER JOIN reviews r ON p.id = r.problem_id
      WHERE r.next_review_date <= date('now')
    `;
    const params: string[] = [];

    if (filters?.platform) {
      query += ' AND p.platform = ?';
      params.push(filters.platform);
    }

    if (filters?.topic) {
      query += ' AND p.topic = ?';
      params.push(filters.topic);
    }

    if (filters?.difficulty) {
      query += ' AND p.difficulty = ?';
      params.push(filters.difficulty);
    }

    if (filters?.confidenceScore) {
      query += ' AND r.confidence_score = ?';
      params.push(filters.confidenceScore);
    }

    query += ' ORDER BY r.next_review_date ASC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as (ProblemRow & ReviewRow)[];
  }

  /**
   * Get review history for a problem
   */
  getReviewHistory(problemId: string, limit?: number): ReviewHistoryRow[] {
    let query = `
      SELECT * FROM review_history
      WHERE problem_id = ?
      ORDER BY review_date DESC
    `;

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    const stmt = this.db.prepare(query);
    return stmt.all(problemId) as ReviewHistoryRow[];
  }

  /**
   * Set a configuration value
   */
  setConfig(key: string, value: string): void {
    this.statements.setConfig!.run(key, value);
  }

  /**
   * Get a configuration value
   */
  getConfig(key: string): string | undefined {
    const result = this.statements.getConfig!.get(key) as ConfigRow | undefined;
    return result?.value;
  }

  /**
   * Execute a function within a transaction
   */
  transaction<T>(fn: () => T): T {
    const trx = this.db.transaction(fn);
    return trx();
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalProblems: number;
    byPlatform: Record<string, number>;
    byDifficulty: Record<string, number>;
    byTopic: Record<string, number>;
    byConfidence: Record<string, number>;
    dueCount: number;
  } {
    const stats = {
      totalProblems: 0,
      byPlatform: {} as Record<string, number>,
      byDifficulty: {} as Record<string, number>,
      byTopic: {} as Record<string, number>,
      byConfidence: {} as Record<string, number>,
      dueCount: 0,
    };

    // Total problems
    const totalResult = this.db.prepare('SELECT COUNT(*) as count FROM problems').get() as { count: number };
    stats.totalProblems = totalResult.count;

    // By platform
    const platformResults = this.db.prepare(`
      SELECT platform, COUNT(*) as count FROM problems GROUP BY platform
    `).all() as { platform: string; count: number }[];
    
    for (const row of platformResults) {
      stats.byPlatform[row.platform] = row.count;
    }

    // By difficulty
    const difficultyResults = this.db.prepare(`
      SELECT difficulty, COUNT(*) as count FROM problems GROUP BY difficulty
    `).all() as { difficulty: string; count: number }[];
    
    for (const row of difficultyResults) {
      stats.byDifficulty[row.difficulty] = row.count;
    }

    // By topic
    const topicResults = this.db.prepare(`
      SELECT topic, COUNT(*) as count FROM problems GROUP BY topic ORDER BY count DESC LIMIT 10
    `).all() as { topic: string; count: number }[];
    
    for (const row of topicResults) {
      stats.byTopic[row.topic] = row.count;
    }

    // By confidence
    const confidenceResults = this.db.prepare(`
      SELECT confidence_score, COUNT(*) as count FROM reviews GROUP BY confidence_score
    `).all() as { confidence_score: string; count: number }[];
    
    for (const row of confidenceResults) {
      stats.byConfidence[row.confidence_score] = row.count;
    }

    // Due count
    const dueResult = this.db.prepare(`
      SELECT COUNT(*) as count FROM reviews WHERE next_review_date <= date('now')
    `).get() as { count: number };
    stats.dueCount = dueResult.count;

    return stats;
  }

  /**
   * Get streak statistics (consecutive days of review)
   */
  getStreakStats(): {
    currentStreak: number;
    longestStreak: number;
    totalReviewDays: number;
  } {
    const datesResult = this.db.prepare(`
      SELECT DISTINCT date(review_date) as review_day 
      FROM review_history 
      ORDER BY review_day DESC
    `).all() as { review_day: string }[];

    if (datesResult.length === 0) {
      return { currentStreak: 0, longestStreak: 0, totalReviewDays: 0 };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    let currentStreak = 0;
    let longestStreak = 0;
    let currentRunningStreak = 0;
    let previousDate: Date | null = null;

    for (let i = 0; i < datesResult.length; i++) {
      const currentDateStr = datesResult[i]!.review_day;
      const currentDate = new Date(currentDateStr);

      if (previousDate === null) {
        currentRunningStreak = 1;
      } else {
        const diffTime = previousDate.getTime() - currentDate.getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);

        if (diffDays === 1) {
          currentRunningStreak++;
        } else {
          // Streak broken
          currentRunningStreak = 1;
        }
      }

      // Check if this is part of the current active streak
      if (i === 0 && (currentDateStr === todayStr || currentDateStr === yesterdayStr)) {
        // We will update currentStreak as long as it's contiguous from today/yesterday
      }
      
      // We calculate currentStreak slightly differently: 
      // We just iterate forward from index 0 until the gap is > 1
      if (longestStreak < currentRunningStreak) {
        longestStreak = currentRunningStreak;
      }

      previousDate = currentDate;
    }

    // Recalculate true current streak from the top
    let trueCurrentStreak = 0;
    if (datesResult[0]!.review_day === todayStr || datesResult[0]!.review_day === yesterdayStr) {
      trueCurrentStreak = 1;
      for (let i = 1; i < datesResult.length; i++) {
        const d1 = new Date(datesResult[i-1]!.review_day);
        const d2 = new Date(datesResult[i]!.review_day);
        const diff = (d1.getTime() - d2.getTime()) / (1000 * 3600 * 24);
        if (diff === 1) {
          trueCurrentStreak++;
        } else {
          break;
        }
      }
    }

    return {
      currentStreak: trueCurrentStreak,
      longestStreak: Math.max(longestStreak, trueCurrentStreak),
      totalReviewDays: datesResult.length
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the raw database instance (for advanced operations)
   */
  getRawDatabase(): Database.Database {
    return this.db;
  }
}
