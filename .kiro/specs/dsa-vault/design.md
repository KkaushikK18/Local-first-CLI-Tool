# Design Document: DSA Vault

## Overview

DSA Vault is a local-first CLI tool that automates the workflow of capturing solved coding problems from LeetCode and GeeksforGeeks, storing them in a structured Git repository, and scheduling spaced-repetition reviews. The system implements a complete end-to-end pipeline from browser automation through structured storage to intelligent revision scheduling.

### Design Goals

1. **Zero Manual Data Entry**: Automatically extract problem metadata and accepted solutions from platform web pages
2. **Structured Storage**: Maintain a clean, browsable file hierarchy with problems organized by platform and topic
3. **Revision Optimization**: Implement spaced-repetition scheduling to maximize long-term retention
4. **Git-First Workflow**: Automatically commit and push changes to maintain backup and synchronization
5. **Extensibility**: Support adding new platforms through a modular adapter pattern
6. **Type Safety**: Leverage TypeScript for compile-time validation of data structures and workflows
7. **Developer Experience**: Provide clear CLI commands with helpful error messages and progress feedback

### Technology Stack

- **Runtime**: Node.js 18+ with TypeScript 5.x
- **Browser Automation**: Playwright (connect-over-CDP for existing browser sessions)
- **Database**: SQLite via better-sqlite3 (synchronous API, WAL mode)
- **CLI Framework**: Commander.js 11.x
- **Validation**: Zod 3.x (runtime schema validation)
- **Git Operations**: simple-git 3.x
- **Interactive Prompts**: Inquirer.js 9.x
- **Testing**: Vitest (unit) + property-based testing library (fast-check)

### Design Principles

1. **Fail Fast**: Validate inputs early and provide clear error messages
2. **Idempotent Operations**: Support re-running commands safely without data loss
3. **Atomic Commits**: Ensure file system and database operations are consistent
4. **Offline-First**: Core functionality works without network access except for Git push
5. **Progressive Enhancement**: Start with MVP feature set, add advanced features incrementally

## Architecture

### High-Level Architecture

The system follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                       CLI Interface Layer                    │
│  (Commander.js commands + Inquirer prompts)                 │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ Problem Capture │  │   Revision   │  │  Sync & Config │ │
│  │     Engine      │  │    Engine    │  │    Manager     │ │
│  └─────────────────┘  └──────────────┘  └────────────────┘ │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│                    Domain Layer                              │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │  Platform    │  │   Storage     │  │  Spaced Rep     │  │
│  │  Adapters    │  │   Layer       │  │  Algorithm      │  │
│  └──────────────┘  └───────────────┘  └─────────────────┘  │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│                 Infrastructure Layer                         │
│  ┌──────────┐  ┌─────────┐  ┌────────────┐  ┌───────────┐  │
│  │ Playwright│  │ SQLite  │  │    Git     │  │   File    │  │
│  │  Browser  │  │   DB    │  │ Operations │  │  System   │  │
│  └──────────┘  └─────────┘  └────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Module Boundaries

**CLI Interface Layer**
- Parses command-line arguments and flags
- Orchestrates application layer services
- Handles user interaction and feedback
- Formats output for terminal display
- **Dependencies**: Application Layer
- **No dependencies on**: Domain or Infrastructure layers directly

**Application Layer**
- Implements high-level workflows (capture, review, sync)
- Coordinates between domain services
- Manages transaction boundaries
- Handles workflow-level error recovery
- **Dependencies**: Domain Layer
- **No dependencies on**: Infrastructure layer directly

**Domain Layer**
- Implements core business logic
- Defines domain models and interfaces
- Platform-specific extraction logic
- Spaced-repetition algorithm
- Storage operations
- **Dependencies**: Infrastructure Layer (through interfaces)

**Infrastructure Layer**
- Provides technical capabilities (database, file I/O, Git, browser)
- No business logic
- Implements interfaces defined by Domain Layer
- **Dependencies**: External libraries only

### Data Flow

**Problem Capture Flow**:
```
Browser Page → Platform Adapter → Problem Capture Engine → Storage Layer → Database + Files → Git Repository
```

**Revision Flow**:
```
Database Query → Revision Engine → CLI Display → User Input → Spaced Rep Algorithm → Database Update
```

### Error Handling Strategy

The system uses a hierarchical error handling approach:

1. **Domain Errors**: Business logic errors (duplicate problem, invalid metadata)
2. **Infrastructure Errors**: Technical failures (network, file system, database)
3. **User Errors**: Invalid input or configuration

Each error type is modeled as a TypeScript discriminated union with specific error codes and recovery suggestions.

## Components and Interfaces

### Platform Adapter System

Platform Adapters implement a common interface for extracting problem data from different coding platforms.

**Interface: `IPlatformAdapter`**

```typescript
interface IPlatformAdapter {
  readonly name: PlatformName; // 'leetcode' | 'geeksforgeeks'
  
  /**
   * Detect if the current page is a problem page for this platform
   */
  canHandle(url: string): boolean;
  
  /**
   * Extract problem metadata from the current page
   * @throws ExtractionError if required fields are missing
   */
  extractMetadata(page: Page): Promise<ProblemMetadata>;
  
  /**
   * Extract the accepted solution code from the editor
   * @throws ExtractionError if code or language cannot be determined
   */
  extractSolution(page: Page): Promise<Solution>;
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated(page: Page): Promise<boolean>;
}
```

**LeetCode Adapter Implementation**

The LeetCode adapter uses Playwright selectors to extract data from the problem page DOM:

- **Title**: `.text-title-large` or `[data-cy="question-title"]`
- **Difficulty**: `.text-difficulty-{easy|medium|hard}` or tag with difficulty class
- **Tags**: `.topic-tag` elements within topics section
- **Description**: `.elfjS` (description container) or `[data-track-load="description_content"]`
- **Code**: Monaco editor content via `window.monaco` API or textarea fallback
- **Language**: Language selector dropdown current value

**Strategy**: The adapter first attempts to query the GraphQL API endpoint (`/graphql`) that LeetCode uses internally, falling back to DOM scraping if API access fails.

**GeeksforGeeks Adapter Implementation**

The GFG adapter extracts from a different DOM structure:

- **Title**: `.problems_problem_content__title` or `h1.problem-title`
- **Difficulty**: `.difficulty-text` or difficulty pill component
- **Tags**: `.topic-tags a` or tag chips
- **Description**: `.problems_problem_content__description` or main content container
- **Code**: CodeMirror editor via `.CodeMirror` API or textarea
- **Language**: Language dropdown or tab indicator

**Strategy**: GFG requires scraping as they don't expose a stable API. The adapter uses robust selectors with multiple fallbacks.

### Capture Engine

The Capture Engine orchestrates the complete problem capture workflow.

**Interface: `ICaptureEngine`**

```typescript
interface ICaptureEngine {
  /**
   * Capture problem from currently active browser tab
   */
  captureFromBrowser(): Promise<CaptureResult>;
  
  /**
   * Capture problem from explicit URL
   */
  captureFromUrl(url: string): Promise<CaptureResult>;
  
  /**
   * Handle duplicate problem detection
   */
  handleDuplicate(
    existing: ProblemEntry,
    incoming: ProblemData
  ): Promise<DuplicateResolution>;
}

type CaptureResult = 
  | { status: 'success'; entry: ProblemEntry }
  | { status: 'duplicate'; existing: ProblemEntry; resolution: DuplicateResolution }
  | { status: 'error'; error: CaptureError };
```

**Workflow**:

1. **Browser Connection**: Connect to existing browser via CDP using `playwright.chromium.connectOverCDP()`
2. **Tab Discovery**: If no URL provided, enumerate all pages and filter for LeetCode/GFG URLs
3. **Tab Selection**: If multiple matching tabs, prompt user with Inquirer.js
4. **Platform Detection**: Determine which adapter to use based on URL pattern
5. **Authentication Check**: Verify user is logged in before attempting extraction
6. **Metadata Extraction**: Use platform adapter to extract problem metadata
7. **Solution Extraction**: Use platform adapter to extract accepted code
8. **Validation**: Validate extracted data against Zod schemas
9. **Note Collection**: Launch interactive editor (EDITOR env var or vim/nano) for notes
10. **Duplicate Detection**: Check if problem URL exists in database
11. **Duplicate Handling**: If duplicate, prompt user for resolution strategy
12. **Storage**: Save files and database record
13. **Git Commit**: Stage, commit, and optionally push changes

### Revision Engine

The Revision Engine implements spaced-repetition scheduling and review session management.

**Interface: `IRevisionEngine`**

```typescript
interface IRevisionEngine {
  /**
   * Get problems due for review based on filters
   */
  getDueProblems(filters: ReviewFilters): Promise<ProblemEntry[]>;
  
  /**
   * Calculate next review date based on user performance
   */
  scheduleNextReview(
    problemId: string,
    outcome: ReviewOutcome
  ): Promise<ReviewSchedule>;
  
  /**
   * Update problem review statistics
   */
  recordReview(
    problemId: string,
    outcome: ReviewOutcome,
    schedule: ReviewSchedule
  ): Promise<void>;
  
  /**
   * Calculate confidence score based on review history
   */
  calculateConfidence(history: ReviewHistory): ConfidenceLevel;
}

type ReviewOutcome = 'easy' | 'medium' | 'hard' | 'failed';
type ConfidenceLevel = 'weak' | 'medium' | 'strong';

interface ReviewFilters {
  due?: boolean;
  weak?: boolean;
  platform?: PlatformName;
  topic?: string;
  difficulty?: Difficulty;
}
```

**Spaced-Repetition Algorithm**

The system uses a modified SM-2 algorithm optimized for coding problem reviews:

**Initial State**:
- `interval = 1 day`
- `ease_factor = 2.5`
- `review_count = 0`
- `confidence_score = 0` (weak)

**Interval Calculation** (on review):

```typescript
function calculateNextInterval(
  currentInterval: number,
  easeFactor: number,
  outcome: ReviewOutcome
): { interval: number; easeFactor: number } {
  let newEaseFactor = easeFactor;
  let newInterval: number;
  
  switch (outcome) {
    case 'easy':
      newEaseFactor = Math.min(easeFactor + 0.15, 3.0);
      newInterval = currentInterval * 2.5;
      break;
    case 'medium':
      newEaseFactor = Math.max(easeFactor - 0.05, 1.3);
      newInterval = currentInterval * 1.5;
      break;
    case 'hard':
      newEaseFactor = Math.max(easeFactor - 0.15, 1.3);
      newInterval = 1; // Reset to 1 day
      break;
    case 'failed':
      newEaseFactor = Math.max(easeFactor - 0.20, 1.3);
      newInterval = 1; // Reset to 1 day
      break;
  }
  
  // Cap maximum interval at 180 days (6 months)
  newInterval = Math.min(newInterval, 180);
  
  return { interval: newInterval, easeFactor: newEaseFactor };
}
```

**Confidence Score Calculation**:

```typescript
function calculateConfidence(history: ReviewHistory): ConfidenceLevel {
  const { reviewCount, mistakeCount, recentOutcomes } = history;
  
  // Must have at least 3 reviews to be considered strong
  if (reviewCount < 3) return 'weak';
  
  // High mistake count indicates weak understanding
  if (mistakeCount > 2) return 'weak';
  
  // Check recent performance (last 3 reviews)
  const recentEasyCount = recentOutcomes
    .slice(-3)
    .filter(o => o === 'easy').length;
  
  if (recentEasyCount >= 2 && reviewCount >= 5) return 'strong';
  if (recentEasyCount >= 1 || mistakeCount <= 1) return 'medium';
  
  return 'weak';
}
```

**Design Rationale**:

- **Easy multiplier (2.5x)**: Aggressive spacing for problems that feel easy, with ease factor boost
- **Medium multiplier (1.5x)**: Moderate spacing for problems that require some effort
- **Hard/Failed reset (1 day)**: Quick re-review for problems that are difficult or failed
- **Maximum interval (180 days)**: Prevent problems from being forgotten completely
- **Ease factor adjustment**: Problems that consistently feel easy become spaced even more aggressively
- **Confidence calculation**: Requires sustained performance over multiple reviews

### Storage Layer

The Storage Layer manages all persistence operations across SQLite, file system, and Git.

**Interface: `IStorageLayer`**

```typescript
interface IStorageLayer {
  /**
   * Save a complete problem entry (files + database + git)
   */
  saveProblemEntry(data: ProblemData): Promise<ProblemEntry>;
  
  /**
   * Check if problem URL already exists
   */
  findByUrl(url: string): Promise<ProblemEntry | null>;
  
  /**
   * Query problems with filters
   */
  queryProblems(filters: QueryFilters): Promise<ProblemEntry[]>;
  
  /**
   * Update review statistics for a problem
   */
  updateReviewStats(
    problemId: string,
    stats: ReviewStats
  ): Promise<void>;
  
  /**
   * Rebuild database from file system
   */
  rebuildDatabase(): Promise<RebuildResult>;
}
```

**File System Structure**:

```
workspace/
├── problems/
│   ├── leetcode/
│   │   ├── arrays/
│   │   │   ├── two-sum/
│   │   │   │   ├── solution.py
│   │   │   │   ├── notes.md
│   │   │   │   └── meta.json
│   │   │   └── three-sum/
│   │   │       ├── solution.cpp
│   │   │       ├── notes.md
│   │   │       └── meta.json
│   │   └── trees/
│   │       └── ...
│   └── geeksforgeeks/
│       └── ...
├── reviews/
│   └── dsa-vault.db
├── templates/
│   └── notes-template.md
├── scripts/
│   └── (future: custom automation scripts)
├── src/
│   └── (future: reusable code snippets)
├── config.json
└── .git/
```

**File Operations**:

1. **Directory Creation**: Create platform/topic/problem-name hierarchy
2. **Solution File**: Write code with appropriate extension based on language
3. **Notes File**: Write markdown notes from template
4. **Metadata File**: Write JSON metadata for file-based querying
5. **Sanitization**: Convert problem names to kebab-case, remove special characters

**Transaction Strategy**:

To ensure consistency between file system and database:

1. Begin database transaction
2. Write files to disk
3. Insert/update database records
4. Commit transaction
5. On error: rollback transaction and delete created files

### CLI Interface

The CLI uses Commander.js for command parsing and Inquirer.js for interactive prompts.

**Command Structure**:

```
dsa-vault <command> [options]

Commands:
  init                    Initialize workspace
  capture [url]           Capture problem from browser
  review [options]        Start review session
  stats                   Display statistics
  search <query>          Search problems
  sync                    Sync with remote repository
  config [key] [value]    View or set configuration
  import <path>           Import external problems
  doctor                  Diagnose installation
```

**Example: Review Command**:

```bash
# Review all due problems
dsa-vault review --due

# Review weak problems on specific platform
dsa-vault review --weak --platform leetcode

# Review problems by topic and difficulty
dsa-vault review --topic arrays --difficulty hard
```

**Interactive Prompts** (using Inquirer.js):

1. **Tab Selection**: When multiple browser tabs match platforms
2. **Duplicate Resolution**: When problem URL already exists
3. **Review Rating**: After displaying problem during review session
4. **Confirmation**: Before destructive operations (overwrite, delete)

## Data Models

### Core Domain Models

**ProblemMetadata**:

```typescript
interface ProblemMetadata {
  platform: 'leetcode' | 'geeksforgeeks';
  title: string;
  url: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  topic: string;
  description: string;
  language: string;
  dateSolved: Date;
  status: 'solved' | 'attempted' | 'reviewed';
}

const ProblemMetadataSchema = z.object({
  platform: z.enum(['leetcode', 'geeksforgeeks']),
  title: z.string().min(1),
  url: z.string().url(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  tags: z.array(z.string()),
  topic: z.string().default('uncategorized'),
  description: z.string(),
  language: z.string(),
  dateSolved: z.date(),
  status: z.enum(['solved', 'attempted', 'reviewed']).default('solved')
});
```

**Solution**:

```typescript
interface Solution {
  code: string;
  language: string;
  languageExtension: string; // .py, .cpp, .java, etc.
}
```

**ProblemEntry**:

```typescript
interface ProblemEntry {
  id: string; // UUID
  metadata: ProblemMetadata;
  solution: Solution;
  notes: string;
  filePath: string;
  reviewStats: ReviewStats;
}
```

**ReviewStats**:

```typescript
interface ReviewStats {
  firstSolvedDate: Date;
  lastReviewedDate: Date | null;
  nextReviewDate: Date;
  reviewCount: number;
  confidenceScore: 'weak' | 'medium' | 'strong';
  mistakeCount: number;
  easeFactor: number;
  currentInterval: number; // in days
}
```

**ReviewHistory**:

```typescript
interface ReviewHistory {
  reviewCount: number;
  mistakeCount: number;
  recentOutcomes: ReviewOutcome[]; // last 5 reviews
}
```

### Database Schema

**SQLite Tables** (using better-sqlite3):

```sql
-- Enable foreign keys and WAL mode
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Problems table
CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK(platform IN ('leetcode', 'geeksforgeeks')),
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  difficulty TEXT NOT NULL CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
  tags TEXT NOT NULL, -- JSON array
  topic TEXT NOT NULL,
  language TEXT NOT NULL,
  date_solved TEXT NOT NULL, -- ISO 8601 date
  status TEXT NOT NULL CHECK(status IN ('solved', 'attempted', 'reviewed')),
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Review tracking table
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
);

-- Review history table (for tracking individual review sessions)
CREATE TABLE IF NOT EXISTS review_history (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL,
  review_date TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('easy', 'medium', 'hard', 'failed')),
  interval_before REAL NOT NULL,
  interval_after REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

-- Configuration table
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_problems_platform ON problems(platform);
CREATE INDEX IF NOT EXISTS idx_problems_topic ON problems(topic);
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_date_solved ON problems(date_solved);
CREATE INDEX IF NOT EXISTS idx_reviews_next_review_date ON reviews(next_review_date);
CREATE INDEX IF NOT EXISTS idx_reviews_confidence_score ON reviews(confidence_score);
CREATE INDEX IF NOT EXISTS idx_review_history_problem_date ON review_history(problem_id, review_date);
```

**Database Access Pattern**:

Using better-sqlite3's synchronous API for simplicity:

```typescript
import Database from 'better-sqlite3';

class DatabaseService {
  private db: Database.Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
  }
  
  // Use prepared statements for all queries
  saveProblem(entry: ProblemEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO problems (id, platform, title, url, difficulty, tags, topic, language, date_solved, status, file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        difficulty = excluded.difficulty,
        tags = excluded.tags,
        topic = excluded.topic,
        language = excluded.language,
        updated_at = datetime('now')
    `);
    
    stmt.run(
      entry.id,
      entry.metadata.platform,
      entry.metadata.title,
      entry.metadata.url,
      entry.metadata.difficulty,
      JSON.stringify(entry.metadata.tags),
      entry.metadata.topic,
      entry.metadata.language,
      entry.metadata.dateSolved.toISOString(),
      entry.metadata.status,
      entry.filePath
    );
  }
  
  findDueProblems(filters: ReviewFilters): ProblemEntry[] {
    // Prepared statement with dynamic WHERE clause
    // Returns joined data from problems and reviews tables
  }
  
  close(): void {
    this.db.close();
  }
}
```

### Configuration Model

**Configuration File** (`config.json`):

```typescript
interface Config {
  git: {
    remoteUrl: string | null;
    autoPush: boolean;
    branch: string;
  };
  editor: {
    command: string; // e.g., 'code --wait', 'vim', 'nano'
  };
  browser: {
    cdpUrl: string; // e.g., 'http://localhost:9222'
    profile: string | null;
  };
  spacedRepetition: {
    easyMultiplier: number;
    mediumMultiplier: number;
    hardMultiplier: number;
    maxInterval: number;
  };
  defaults: {
    platform: 'leetcode' | 'geeksforgeeks' | null;
    language: string | null;
  };
}

const defaultConfig: Config = {
  git: {
    remoteUrl: null,
    autoPush: false,
    branch: 'main'
  },
  editor: {
    command: process.env.EDITOR || 'vim'
  },
  browser: {
    cdpUrl: 'http://localhost:9222',
    profile: null
  },
  spacedRepetition: {
    easyMultiplier: 2.5,
    mediumMultiplier: 1.5,
    hardMultiplier: 1.0,
    maxInterval: 180
  },
  defaults: {
    platform: null,
    language: null
  }
};
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The DSA Vault system includes several pure functions and data transformations that are amenable to property-based testing. While much of the system involves integration with external services (browser automation, Git, file I/O), the core business logic around validation, serialization, scheduling algorithms, and data transformations can be verified through universal properties.

### Property 1: Notes Validation Rejects Whitespace-Only Input

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), the notes validation function SHALL reject the input and return a validation error.

**Validates: Requirements 4.2**

**Rationale**: Users should not be able to save "empty" notes that appear to have content but contain only whitespace. This property ensures consistent validation across all forms of empty input.

### Property 2: Template Completeness for Any Metadata

*For any* valid ProblemMetadata object, the generated notes template SHALL contain all required sections: Problem, Approach, Complexity, Key Insight, Common Mistakes, and Follow-up Problems.

**Validates: Requirements 4.3, 4.5, 20.1, 20.2**

**Rationale**: The notes template must be consistently structured regardless of problem metadata variations. This ensures users always have the same note-taking framework.

### Property 3: Directory Structure Pattern Consistency

*For any* valid ProblemMetadata with platform and topic, the generated directory path SHALL follow the pattern `problems/{platform}/{topic}/{sanitized-problem-name}/` where sanitized-problem-name is derived from the problem title.

**Validates: Requirements 5.1**

**Rationale**: Consistent directory structure enables predictable navigation and tooling. This property ensures no edge cases in metadata break the directory hierarchy.

### Property 4: File Extension Language Mapping

*For any* supported programming language, the solution file SHALL have an extension that correctly maps to that language (e.g., Python → .py, C++ → .cpp, Java → .java, JavaScript → .js).

**Validates: Requirements 5.2**

**Rationale**: Correct file extensions enable IDE support and syntax highlighting. This property verifies the language-to-extension mapping is complete and correct.

### Property 5: Problem Name Sanitization Safety

*For any* string containing special characters or whitespace, the sanitized problem name SHALL produce a filesystem-safe string containing only alphanumeric characters, hyphens, and underscores.

**Validates: Requirements 5.7**

**Rationale**: Problem titles may contain characters that are invalid in filenames. This property ensures sanitization handles all possible input without filesystem errors.

### Property 6: Database Record Consistency

*For any* valid ProblemEntry, inserting it into the database SHALL create a record where querying by the problem's URL returns a ProblemEntry with equivalent metadata fields.

**Validates: Requirements 6.1**

**Rationale**: Database records must accurately reflect the in-memory representation. This property verifies no data is lost or corrupted during persistence.

### Property 7: Review Initialization Correctness

*For any* newly saved problem with date_solved D, the initialized review stats SHALL have: first_solved_date = D, next_review_date = D + 1 day, review_count = 0, confidence_score = 'weak', mistake_count = 0, ease_factor = 2.5, current_interval = 1.0.

**Validates: Requirements 6.2, 6.5, 6.6, 8.1**

**Rationale**: All new problems must start with consistent initial review statistics to ensure the spaced-repetition algorithm functions correctly from the first review.

### Property 8: Upsert Idempotency for Duplicate URLs

*For any* ProblemEntry with URL U, inserting the entry twice SHALL result in exactly one database record with URL U, with the second insertion updating rather than duplicating.

**Validates: Requirements 6.3**

**Rationale**: URL is the natural key for problems. This property ensures the system is idempotent and prevents duplicate problem records.

### Property 9: Interval Calculation Consistency

*For any* current interval I and review outcome O, the calculated next interval SHALL be:
- If O = 'easy': I × 2.5 (capped at 180 days)
- If O = 'medium': I × 1.5 (capped at 180 days)
- If O = 'hard': 1 day
- If O = 'failed': 1 day

**Validates: Requirements 8.2, 8.3, 8.4, 8.5**

**Rationale**: The spaced-repetition algorithm must consistently calculate intervals based on user performance. This property verifies the core scheduling logic is correct for all inputs.

### Property 10: Confidence Score Calculation Correctness

*For any* ReviewHistory, the calculated confidence score SHALL be:
- 'weak' if review_count < 3 OR mistake_count > 2
- 'strong' if review_count ≥ 5 AND last 3 outcomes include at least 2 'easy'
- 'medium' otherwise

**Validates: Requirements 8.6, 8.7**

**Rationale**: Confidence scores guide users toward weak areas. This property ensures the calculation correctly reflects problem mastery across all possible review histories.

### Property 11: Review State Update Completeness

*For any* problem P with review_count N and last_reviewed_date D1, after recording a review at date D2, the problem SHALL have review_count = N + 1 and last_reviewed_date = D2.

**Validates: Requirements 8.8**

**Rationale**: Review statistics must be accurately maintained over time. This property ensures no review updates are lost or incorrectly applied.

### Property 12: Metadata Serialization Round-Trip

*For any* valid ProblemMetadata object M, parsing the JSON string produced by serializing M SHALL yield an object equivalent to M.

**Validates: Requirements 19.5**

**Rationale**: Metadata files must preserve all information when written and read. This property is critical for data integrity across file-based storage.

**Round-trip definition**: Two metadata objects are equivalent if all fields (platform, title, url, difficulty, tags, topic, description, language, dateSolved, status) have equal values.

### Property 13: Configuration Validation Rejection

*For any* invalid configuration value (e.g., negative interval, invalid platform name, malformed URL), the configuration validation SHALL reject the value and return a specific validation error.

**Validates: Requirements 14.5**

**Rationale**: Invalid configuration can break the system. This property ensures all configuration values are validated before being accepted.


## Error Handling

### Error Taxonomy

The system uses a discriminated union type system for errors, enabling type-safe error handling:

```typescript
type DSAVaultError =
  | BrowserError
  | ExtractionError
  | ValidationError
  | StorageError
  | GitError
  | ConfigError
  | UserCancellationError;

interface BrowserError {
  type: 'browser';
  code: 'NO_BROWSER' | 'CONNECTION_FAILED' | 'CDP_ERROR';
  message: string;
  recovery?: string;
}

interface ExtractionError {
  type: 'extraction';
  code: 'NOT_AUTHENTICATED' | 'MISSING_FIELD' | 'INVALID_PAGE' | 'SELECTOR_FAILED';
  platform: PlatformName;
  field?: string;
  message: string;
  recovery?: string;
}

interface ValidationError {
  type: 'validation';
  code: 'SCHEMA_VALIDATION' | 'EMPTY_NOTES' | 'INVALID_URL' | 'INVALID_CONFIG';
  field: string;
  expected: string;
  actual: string;
  message: string;
}

interface StorageError {
  type: 'storage';
  code: 'FILE_WRITE_FAILED' | 'DB_INSERT_FAILED' | 'DIRECTORY_CREATE_FAILED' | 'PERMISSION_DENIED';
  path?: string;
  message: string;
  recovery?: string;
}

interface GitError {
  type: 'git';
  code: 'NOT_INITIALIZED' | 'COMMIT_FAILED' | 'PUSH_FAILED' | 'MERGE_CONFLICT' | 'NETWORK_ERROR';
  message: string;
  recovery?: string;
}

interface ConfigError {
  type: 'config';
  code: 'MISSING_CONFIG' | 'INVALID_VALUE' | 'FILE_NOT_FOUND';
  key?: string;
  message: string;
  recovery?: string;
}

interface UserCancellationError {
  type: 'cancellation';
  operation: string;
  message: string;
}
```

### Error Recovery Strategies

**Browser Connection Errors**:
- **NO_BROWSER**: Provide instructions to launch browser with CDP enabled: `google-chrome --remote-debugging-port=9222`
- **CONNECTION_FAILED**: Check if browser is running, verify CDP port in config
- **CDP_ERROR**: Suggest updating Playwright or checking browser compatibility

**Extraction Errors**:
- **NOT_AUTHENTICATED**: Prompt user to log in and retry
- **MISSING_FIELD**: Report which field is missing, suggest reporting selector issue if persistent
- **INVALID_PAGE**: Verify user is on a problem page, not homepage or results
- **SELECTOR_FAILED**: Fall back to alternative selectors, prompt user to report issue

**Storage Errors**:
- **FILE_WRITE_FAILED**: Check disk space and permissions
- **DB_INSERT_FAILED**: Rollback transaction, preserve files, suggest running doctor command
- **PERMISSION_DENIED**: Check directory permissions, suggest running with appropriate privileges

**Git Errors**:
- **PUSH_FAILED (conflict)**: Instruct user to manually pull and resolve conflicts
- **PUSH_FAILED (network)**: Confirm files are saved locally, suggest retrying push later
- **NOT_INITIALIZED**: Run doctor command to diagnose, suggest re-init

**Validation Errors**:
- **SCHEMA_VALIDATION**: Display specific field validation failures with expected format
- **INVALID_CONFIG**: Show current value, expected format, and example
- Display clear error messages at point of failure
- Suggest valid alternatives when possible

### Transactional Consistency

To maintain consistency between file system and database:

```typescript
async function saveProblemEntryWithRollback(
  data: ProblemData
): Promise<Result<ProblemEntry, StorageError>> {
  const createdPaths: string[] = [];
  const dbTransaction = db.transaction(() => {
    try {
      // 1. Create directories
      const dirPath = createDirectoryStructure(data.metadata);
      createdPaths.push(dirPath);
      
      // 2. Write solution file
      const solutionPath = writeSolutionFile(dirPath, data.solution);
      createdPaths.push(solutionPath);
      
      // 3. Write notes file
      const notesPath = writeNotesFile(dirPath, data.notes);
      createdPaths.push(notesPath);
      
      // 4. Write metadata file
      const metaPath = writeMetadataFile(dirPath, data.metadata);
      createdPaths.push(metaPath);
      
      // 5. Insert database records
      insertProblemRecord(data);
      insertReviewRecord(data);
      
      return { success: true };
    } catch (error) {
      // Rollback: delete created files
      for (const path of createdPaths) {
        try {
          fs.rmSync(path, { recursive: true, force: true });
        } catch {
          // Best effort cleanup
        }
      }
      throw error;
    }
  });
  
  try {
    dbTransaction();
    return { ok: true, value: createProblemEntry(data) };
  } catch (error) {
    return { ok: false, error: createStorageError(error) };
  }
}
```

### Logging Strategy

**Structured Logging Levels**:
- **ERROR**: Critical failures (extraction failed, database corruption, Git push failed)
- **WARN**: Non-critical issues (duplicate detected, config missing optional field)
- **INFO**: Operation milestones (problem captured, review session completed, sync finished)
- **DEBUG**: Detailed execution (selector tried, query executed, file written)

**Log Format** (JSON for structured parsing):
```json
{
  "timestamp": "2025-02-03T10:30:45.123Z",
  "level": "INFO",
  "operation": "capture",
  "platform": "leetcode",
  "problemUrl": "https://leetcode.com/problems/two-sum",
  "message": "Problem captured successfully",
  "duration": 2345
}
```

## Testing Strategy

### Testing Approach

DSA Vault uses a comprehensive testing strategy combining property-based testing for core algorithms and data transformations with integration tests for external system interactions.


### Unit Tests (Example-Based)

Unit tests verify specific behaviors and edge cases using concrete examples:

**Scope**:
- CLI command parsing and validation
- Platform adapter URL detection (canHandle method)
- File name sanitization with specific problematic characters
- Configuration file loading and saving
- Error message formatting
- Template generation with specific metadata examples

**Example Test Cases**:
```typescript
describe('Problem Name Sanitization', () => {
  it('should handle special characters', () => {
    expect(sanitizeName('Two Sum: Part #1')).toBe('two-sum-part-1');
    expect(sanitizeName('3Sum (Medium/Hard)')).toBe('3sum-medium-hard');
  });
  
  it('should handle unicode characters', () => {
    expect(sanitizeName('Array → String')).toBe('array-string');
  });
});

describe('LeetCode Adapter', () => {
  it('should detect LeetCode URLs', () => {
    const adapter = new LeetCodeAdapter();
    expect(adapter.canHandle('https://leetcode.com/problems/two-sum')).toBe(true);
    expect(adapter.canHandle('https://geeksforgeeks.org/problems/two-sum')).toBe(false);
  });
});
```

**Test Count**: Aim for 20-30 unit tests covering edge cases, error paths, and specific examples.

### Property-Based Tests

Property-based tests verify universal properties across many randomly generated inputs using fast-check.

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property reference
- Tag format: `@property Feature: dsa-vault, Property N: {property_text}`

**Property Test Framework**:
```typescript
import fc from 'fast-check';

describe('Correctness Properties', () => {
  it('@property Feature: dsa-vault, Property 1: Notes validation rejects whitespace', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')),
        (whitespaceString) => {
          const result = validateNotes(whitespaceString);
          expect(result.valid).toBe(false);
          expect(result.error?.code).toBe('EMPTY_NOTES');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('@property Feature: dsa-vault, Property 2: Template completeness', () => {
    fc.assert(
      fc.property(
        arbitraryProblemMetadata(),
        (metadata) => {
          const template = generateNotesTemplate(metadata);
          expect(template).toContain('## Problem');
          expect(template).toContain('## Approach');
          expect(template).toContain('## Complexity');
          expect(template).toContain('## Key Insight');
          expect(template).toContain('## Common Mistakes');
          expect(template).toContain('## Follow-up Problems');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('@property Feature: dsa-vault, Property 9: Interval calculation', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 180 }),
        fc.constantFrom('easy', 'medium', 'hard', 'failed'),
        (currentInterval, outcome) => {
          const result = calculateNextInterval(currentInterval, 2.5, outcome);
          
          if (outcome === 'easy') {
            expect(result.interval).toBe(Math.min(currentInterval * 2.5, 180));
          } else if (outcome === 'medium') {
            expect(result.interval).toBe(Math.min(currentInterval * 1.5, 180));
          } else {
            expect(result.interval).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('@property Feature: dsa-vault, Property 12: Metadata serialization round-trip', () => {
    fc.assert(
      fc.property(
        arbitraryProblemMetadata(),
        (metadata) => {
          const json = JSON.stringify(metadata);
          const parsed = ProblemMetadataSchema.parse(JSON.parse(json));
          
          expect(parsed.platform).toBe(metadata.platform);
          expect(parsed.title).toBe(metadata.title);
          expect(parsed.url).toBe(metadata.url);
          expect(parsed.difficulty).toBe(metadata.difficulty);
          expect(parsed.tags).toEqual(metadata.tags);
          expect(parsed.topic).toBe(metadata.topic);
          expect(parsed.language).toBe(metadata.language);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Arbitrary generators for property tests
function arbitraryProblemMetadata(): fc.Arbitrary<ProblemMetadata> {
  return fc.record({
    platform: fc.constantFrom('leetcode', 'geeksforgeeks'),
    title: fc.string({ minLength: 5, maxLength: 100 }),
    url: fc.webUrl(),
    difficulty: fc.constantFrom('Easy', 'Medium', 'Hard'),
    tags: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
    topic: fc.string({ minLength: 3, maxLength: 30 }),
    description: fc.lorem({ maxCount: 3 }),
    language: fc.constantFrom('python', 'javascript', 'java', 'cpp'),
    dateSolved: fc.date(),
    status: fc.constantFrom('solved', 'attempted', 'reviewed')
  });
}
```

**Property Test Count**: 13 property tests (one per correctness property).

### Integration Tests

Integration tests verify interactions with external systems using real dependencies.

**Scope**:
- Browser automation with Playwright (test against local HTML fixtures)
- SQLite database operations (use in-memory database)
- Git operations (use temporary test repository)
- File system operations (use temporary test directories)

**Example Integration Test**:
```typescript
describe('Problem Capture Integration', () => {
  let browser: Browser;
  let tempDir: string;
  let db: Database;
  
  beforeAll(async () => {
    browser = await chromium.launch();
    tempDir = fs.mkdtempSync('/tmp/dsa-vault-test-');
    db = new Database(':memory:');
  });
  
  afterAll(async () => {
    await browser.close();
    fs.rmSync(tempDir, { recursive: true });
    db.close();
  });
  
  it('should capture LeetCode problem from HTML fixture', async () => {
    const page = await browser.newPage();
    await page.goto(`file://${__dirname}/fixtures/leetcode-two-sum.html`);
    
    const adapter = new LeetCodeAdapter();
    const metadata = await adapter.extractMetadata(page);
    
    expect(metadata.title).toBe('Two Sum');
    expect(metadata.difficulty).toBe('Easy');
    expect(metadata.tags).toContain('Array');
    expect(metadata.tags).toContain('Hash Table');
    
    await page.close();
  });
  
  it('should save problem entry with files and database record', async () => {
    const storage = new StorageLayer(tempDir, db);
    const problemData: ProblemData = {
      metadata: {
        platform: 'leetcode',
        title: 'Two Sum',
        url: 'https://leetcode.com/problems/two-sum',
        difficulty: 'Easy',
        tags: ['Array', 'Hash Table'],
        topic: 'arrays',
        description: 'Find two numbers that add up to target',
        language: 'python',
        dateSolved: new Date(),
        status: 'solved'
      },
      solution: {
        code: 'def two_sum(nums, target): ...',
        language: 'python',
        languageExtension: '.py'
      },
      notes: '# Key insight\nUse hash map for O(n) solution'
    };
    
    const result = await storage.saveProblemEntry(problemData);
    
    expect(result.ok).toBe(true);
    expect(fs.existsSync(`${tempDir}/problems/leetcode/arrays/two-sum/solution.py`)).toBe(true);
    expect(fs.existsSync(`${tempDir}/problems/leetcode/arrays/two-sum/notes.md`)).toBe(true);
    expect(fs.existsSync(`${tempDir}/problems/leetcode/arrays/two-sum/meta.json`)).toBe(true);
    
    const dbRecord = db.prepare('SELECT * FROM problems WHERE url = ?').get(problemData.metadata.url);
    expect(dbRecord).toBeDefined();
    expect(dbRecord.title).toBe('Two Sum');
  });
});
```

**Integration Test Count**: 15-20 tests covering critical paths through the system.

### Test Organization

```
tests/
├── unit/
│   ├── sanitization.test.ts
│   ├── validation.test.ts
│   ├── platform-detection.test.ts
│   └── config.test.ts
├── properties/
│   ├── correctness.test.ts        # All 13 property tests
│   ├── arbitraries.ts             # Generators for property tests
│   └── helpers.ts
├── integration/
│   ├── capture.test.ts
│   ├── storage.test.ts
│   ├── revision.test.ts
│   ├── git.test.ts
│   └── cli.test.ts
└── fixtures/
    ├── leetcode-two-sum.html
    ├── geeksforgeeks-sample.html
    └── sample-problems/

```

### Test Coverage Goals

- **Unit Tests**: 80%+ coverage of utility functions and validators
- **Property Tests**: 100% coverage of correctness properties (13 properties)
- **Integration Tests**: 70%+ coverage of critical workflows
- **End-to-End**: Manual testing for browser automation and Git workflows

### Continuous Integration

**CI Pipeline** (GitHub Actions):
1. Run unit tests on every commit
2. Run property tests (100 iterations) on every PR
3. Run integration tests on every PR
4. Run property tests with increased iterations (1000) nightly
5. Generate coverage reports and fail if below thresholds

**Performance Benchmarks**:
- Property tests should complete in < 30 seconds
- Integration tests should complete in < 2 minutes
- Full test suite should complete in < 5 minutes

### Test Data Management

**Fixtures**:
- Store HTML snapshots of LeetCode and GFG problem pages
- Update fixtures periodically to detect selector breakage
- Version control fixtures in repository

**Mocking Strategy**:
- Mock browser automation for unit tests
- Use real Playwright for integration tests with local HTML
- Mock Git operations for unit tests
- Use temporary Git repos for integration tests
- Use in-memory SQLite for fast integration tests

