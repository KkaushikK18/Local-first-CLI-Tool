# Implementation Plan: DSA Vault

## Overview

DSA Vault is a local-first CLI tool built with TypeScript/Node.js that automates the capture of solved coding problems from LeetCode and GeeksforGeeks, stores them in a structured Git repository with SQLite metadata, and implements spaced-repetition review scheduling. The implementation follows a bottom-up approach starting with infrastructure, building up through domain models and business logic, and finishing with CLI commands and integration.

## Tasks

- [x] 1. Project scaffolding and infrastructure setup
  - [ ] 1.1 Initialize TypeScript Node.js project with dependencies
    - Create package.json with Node.js 18+, TypeScript 5.x
    - Install core dependencies: commander, inquirer, better-sqlite3, simple-git, playwright, zod
    - Install dev dependencies: vitest, fast-check, @types packages
    - Configure tsconfig.json with strict mode and Node.js target
    - Set up build scripts (tsc) and development scripts
    - Create project structure: src/, tests/, templates/
    - _Requirements: 1.1, 1.3_

  - [ ]* 1.2 Configure testing framework and property-based testing
    - Set up Vitest configuration for unit and integration tests
    - Install and configure fast-check for property-based tests
    - Create test directory structure (unit/, properties/, integration/, fixtures/)
    - Configure test scripts in package.json
    - _Requirements: Testing strategy_

- [ ] 2. Database schema and configuration management
  - [~] 2.1 Implement SQLite database schema and initialization
    - Create DatabaseService class with better-sqlite3
    - Implement schema creation with tables: problems, reviews, review_history, config
    - Add indexes for common queries (platform, topic, difficulty, next_review_date)
    - Enable WAL mode and foreign key constraints
    - Implement prepared statement helpers for type-safe queries
    - _Requirements: 6.1, 6.2_

  - [~] 2.2 Implement configuration management system
    - Define Config interface with git, editor, browser, spacedRepetition, defaults sections
    - Implement ConfigService for loading, saving, and validating configuration
    - Create default configuration with sensible defaults
    - Implement config.json file persistence in workspace root
    - _Requirements: 14.1, 14.6_

  - [ ]* 2.3 Write property test for configuration validation
    - **Property 13: Configuration validation rejects invalid values**
    - **Validates: Requirements 14.5**
    - Generate arbitrary invalid config values (negative intervals, malformed URLs)
    - Verify validation rejects all invalid inputs with specific errors


- [ ] 3. Core domain models and validation
  - [x] 3.1 Define TypeScript types and Zod schemas for domain models
    - Create ProblemMetadata interface and Zod schema
    - Create Solution, ProblemEntry, ReviewStats interfaces
    - Create ReviewHistory, ReviewOutcome, ConfidenceLevel types
    - Create error discriminated union types (DSAVaultError hierarchy)
    - Implement validation functions using Zod
    - _Requirements: 19.1, 19.2, 19.3_

  - [x] 3.2 Implement problem name sanitization
    - Create sanitizeProblemName function to convert titles to filesystem-safe names
    - Handle special characters, whitespace, unicode
    - Convert to kebab-case format (lowercase with hyphens)
    - _Requirements: 5.7_

  - [x]* 3.3 Write property test for problem name sanitization
    - **Property 5: Problem name sanitization produces filesystem-safe strings**
    - **Validates: Requirements 5.7**
    - Generate arbitrary strings with special characters, whitespace, unicode
    - Verify output contains only alphanumeric, hyphens, underscores

  - [x] 3.4 Implement notes validation
    - Create validateNotes function to reject empty or whitespace-only notes
    - Return validation result with error code for empty notes
    - _Requirements: 4.2_

  - [x]* 3.5 Write property test for notes validation
    - **Property 1: Notes validation rejects whitespace-only input**
    - **Validates: Requirements 4.2**
    - Generate arbitrary whitespace-only strings (spaces, tabs, newlines)
    - Verify validation rejects all whitespace input with EMPTY_NOTES error

  - [x] 3.6 Implement language-to-extension mapping
    - Create getFileExtension function mapping languages to extensions
    - Support: python→.py, javascript→.js, java→.java, cpp→.cpp, c→.c, typescript→.ts
    - _Requirements: 5.2_

  - [x]* 3.7 Write property test for language extension mapping
    - **Property 4: File extension language mapping is correct**
    - **Validates: Requirements 5.2**
    - Generate arbitrary supported languages
    - Verify correct extension mapping for all languages


- [x] 4. Storage layer implementation
  - [x] 4.1 Implement file system storage operations
    - Create StorageService with methods for directory creation, file writing
    - Implement createDirectoryStructure following problems/{platform}/{topic}/{problem-name}/ pattern
    - Implement writeSolutionFile, writeNotesFile, writeMetadataFile
    - Handle file system errors and permissions
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x]* 4.2 Write property test for directory structure pattern
    - **Property 3: Directory structure follows consistent pattern**
    - **Validates: Requirements 5.1**
    - Generate arbitrary valid ProblemMetadata (various platforms, topics)
    - Verify generated path matches problems/{platform}/{topic}/{sanitized-name}/ pattern

  - [x] 4.3 Implement database operations for problems
    - Create saveProblem method with INSERT OR UPDATE using URL as key
    - Create findByUrl method for duplicate detection
    - Create queryProblems method with filters (platform, topic, difficulty, confidence)
    - Implement updateReviewStats method
    - Use prepared statements for all queries
    - _Requirements: 6.1, 6.3, 12.1_

  - [x]* 4.4 Write property test for database record consistency
    - **Property 6: Database records match in-memory representation**
    - **Validates: Requirements 6.1**
    - Generate arbitrary ProblemEntry, insert into database
    - Query by URL and verify all metadata fields are equivalent

  - [x]* 4.5 Write property test for upsert idempotency
    - **Property 8: Duplicate URLs result in single record**
    - **Validates: Requirements 6.3**
    - Generate arbitrary ProblemEntry, insert twice with same URL
    - Verify only one record exists in database

  - [x] 4.6 Implement transactional save with rollback
    - Create saveProblemEntry method coordinating files + database
    - Implement rollback mechanism to delete files on database failure
    - Track created file paths for cleanup
    - Use database transaction for atomicity
    - _Requirements: 5.5, 6.4_

  - [x] 4.7 Implement notes template generation
    - Create generateNotesTemplate function using notes-template.md
    - Populate sections: Problem, Approach, Complexity, Key Insight, Common Mistakes, Follow-up
    - Include problem metadata (title, platform, difficulty, URL) in Problem section
    - _Requirements: 4.3, 4.5, 20.1, 20.2, 20.3, 20.4, 20.5_

  - [x]* 4.8 Write property test for template completeness
    - **Property 2: Template contains all required sections**
    - **Validates: Requirements 4.3, 4.5, 20.1, 20.2**
    - Generate arbitrary ProblemMetadata
    - Verify template contains all 6 required sections (Problem, Approach, Complexity, Key Insight, Common Mistakes, Follow-up)


  - [x] 4.9 Implement metadata serialization
    - Create serializeMetadata and deserializeMetadata functions
    - Use JSON.stringify with 2-space indentation for meta.json
    - Validate against schema before serialization
    - Handle Date serialization to ISO 8601 format
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [x]* 4.10 Write property test for metadata serialization round-trip
    - **Property 12: Metadata serialization preserves all data**
    - **Validates: Requirements 19.5**
    - Generate arbitrary ProblemMetadata, serialize to JSON, parse back
    - Verify all fields are equivalent (platform, title, url, difficulty, tags, topic, language, dateSolved, status)

- [~] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Platform adapters (LeetCode and GeeksforGeeks)
  - [x] 6.1 Implement IPlatformAdapter interface
    - Define interface with canHandle, extractMetadata, extractSolution, isAuthenticated methods
    - Create PlatformAdapter base class with common utilities
    - Define ExtractionError types for adapter failures
    - _Requirements: 2.1, 3.1, 18.1_

  - [x] 6.2 Implement LeetCode platform adapter
    - Implement canHandle to detect leetcode.com URLs
    - Implement extractMetadata using DOM selectors (.text-title-large, difficulty tags, .topic-tag, description)
    - Implement extractSolution using Monaco editor API or textarea fallback
    - Implement isAuthenticated by checking for user profile element
    - Add fallback to GraphQL API for metadata extraction
    - Handle selector failures with multiple fallback selectors
    - _Requirements: 2.1, 2.2, 2.4, 2.6, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [x] 6.3 Implement GeeksforGeeks platform adapter
    - Implement canHandle to detect geeksforgeeks.org URLs
    - Implement extractMetadata using GFG-specific selectors (.problems_problem_content__title, .difficulty-text, .topic-tags)
    - Implement extractSolution using CodeMirror API or textarea fallback
    - Implement isAuthenticated by checking for user login indicator
    - Handle selector failures with multiple fallback selectors
    - _Requirements: 3.1, 3.2, 3.4, 3.6, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [x] 6.4 Create platform adapter factory
    - Implement detectPlatform function to select adapter based on URL
    - Create adapter registry for extensibility
    - Return appropriate adapter instance or error if platform not supported
    - _Requirements: 2.1, 3.1_


- [ ] 7. Capture engine workflow
  - [x] 7.1 Implement browser connection via CDP
    - Create BrowserService to connect to existing browser using playwright.chromium.connectOverCDP()
    - Read CDP URL from configuration (default: http://localhost:9222)
    - Handle connection failures with clear error messages
    - Provide instructions for launching browser with remote debugging
    - _Requirements: 2.1, 2.3_

  - [x] 7.2 Implement browser tab discovery and selection
    - Enumerate all browser pages/tabs from connected browser
    - Filter tabs by LeetCode or GeeksforGeeks URLs
    - If multiple tabs, prompt user with Inquirer.js to select correct tab
    - Handle case when no matching tabs found
    - _Requirements: 2.5, 3.5_

  - [x] 7.3 Implement problem capture orchestration
    - Create CaptureEngine class implementing ICaptureEngine
    - Implement captureFromBrowser: connect, discover tabs, extract data, save
    - Implement captureFromUrl: navigate to URL, extract data, save
    - Coordinate platform adapter, validation, and storage operations
    - Handle authentication check before extraction
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 7.4 Implement interactive note collection
    - Launch user's editor (from config or EDITOR env var) with template
    - Wait for editor to close and read saved notes
    - Validate notes are non-empty
    - Prompt for confirmation if user cancels note entry
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 7.5 Implement duplicate detection and handling
    - Check if problem URL exists in database before saving
    - If duplicate, prompt user with options: overwrite, merge notes, skip, create new version
    - Implement overwrite: replace solution, append notes
    - Implement merge: keep solution, append notes
    - Implement skip: exit without changes
    - Implement new version: append version suffix to directory name
    - Preserve review history for all options except new version
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

  - [x] 7.6 Implement Git commit and push operations
    - Create GitService using simple-git
    - Implement stage, commit, push operations
    - Use commit message format: "Add {platform} problem: {title}"
    - Handle missing remote (skip push with info message)
    - Handle push failures (conflicts, network errors) with clear messages
    - Respect auto-push configuration setting
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_


- [~] 8. Checkpoint - Ensure capture workflow tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Spaced-repetition algorithm and revision engine
  - [x] 9.1 Implement interval calculation algorithm
    - Create calculateNextInterval function implementing modified SM-2 algorithm
    - Handle outcomes: easy (×2.5), medium (×1.5), hard (×1), failed (×1)
    - Update ease factor based on outcome (+0.15 easy, -0.05 medium, -0.15 hard, -0.20 failed)
    - Cap maximum interval at 180 days
    - Clamp ease factor between 1.3 and 3.0
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [x]* 9.2 Write property test for interval calculation
    - **Property 9: Interval calculation follows algorithm consistently**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**
    - Generate arbitrary current intervals (1-180 days) and outcomes
    - Verify calculated interval matches expected formula for each outcome
    - Verify ease factor adjustments are correct
    - Verify maximum interval cap is enforced

  - [x] 9.3 Implement confidence score calculation
    - Create calculateConfidence function based on ReviewHistory
    - Return 'weak' if review_count < 3 OR mistake_count > 2
    - Return 'strong' if review_count ≥ 5 AND last 3 reviews include 2+ 'easy'
    - Return 'medium' otherwise
    - _Requirements: 8.6, 8.7_

  - [x]* 9.4 Write property test for confidence score calculation
    - **Property 10: Confidence score reflects mastery correctly**
    - **Validates: Requirements 8.6, 8.7**
    - Generate arbitrary ReviewHistory (various counts, mistakes, outcomes)
    - Verify confidence score matches expected rules

  - [x] 9.5 Implement review initialization for new problems
    - Create initializeReviewStats function for new problem entries
    - Set first_solved_date to date_solved
    - Set next_review_date to date_solved + 1 day
    - Set review_count = 0, confidence_score = 'weak', mistake_count = 0
    - Set ease_factor = 2.5, current_interval = 1.0
    - _Requirements: 6.2, 6.5, 6.6, 8.1_

  - [x]* 9.6 Write property test for review initialization
    - **Property 7: Review initialization is correct for all dates**
    - **Validates: Requirements 6.2, 6.5, 6.6, 8.1**
    - Generate arbitrary date_solved dates
    - Verify all initial fields match expected values
    - Verify next_review_date = date_solved + 1 day

  - [x] 9.7 Implement revision engine core logic
    - Create RevisionEngine class implementing IRevisionEngine
    - Implement getDueProblems with filtering (due, weak, platform, topic, difficulty)
    - Implement scheduleNextReview using interval calculation
    - Implement recordReview to update database with new stats
    - Update last_reviewed_date, increment review_count, record outcome in history
    - _Requirements: 8.8, 9.1, 9.2, 10.1, 10.2, 10.3, 10.4, 10.5_


  - [x]* 9.8 Write property test for review state updates
    - **Property 11: Review updates maintain correct state**
    - **Validates: Requirements 8.8**
    - Generate arbitrary problem with review stats, record review
    - Verify review_count incremented, last_reviewed_date updated

- [~] 10. Checkpoint - Ensure revision engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. CLI commands - Core initialization
  - [x] 11.1 Set up Commander.js CLI framework
    - Create main CLI entry point with commander
    - Define program metadata (name, version, description)
    - Set up global error handler with structured error display
    - Configure help text and usage examples
    - _Requirements: All CLI requirements_

  - [x] 11.2 Implement init command
    - Create workspace directory structure: problems/, reviews/, templates/, scripts/, src/
    - Initialize Git repository with git init
    - Create SQLite database in reviews/dsa-vault.db
    - Create default notes-template.md in templates/
    - Create default config.json with defaults
    - Handle existing workspace (report and exit)
    - Handle Git initialization failures with remediation instructions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x]* 11.3 Write unit tests for init command
    - Test workspace creation in temporary directory
    - Test detection of existing workspace
    - Test Git initialization
    - Test database creation with correct schema

- [ ] 12. CLI commands - Problem capture
  - [x] 12.1 Implement capture command
    - Accept optional URL argument
    - If no URL, call captureFromBrowser (discover tabs)
    - If URL provided, call captureFromUrl
    - Display progress messages during extraction
    - Display success message with file paths on completion
    - Handle all error types with user-friendly messages
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [ ]* 12.2 Write integration test for capture workflow
    - Create HTML fixture for LeetCode problem page
    - Test extracting metadata from fixture
    - Test saving files and database record
    - Verify Git commit is created


- [ ] 13. CLI commands - Review sessions
  - [~] 13.1 Implement review command with filters
    - Accept flags: --due, --weak, --platform, --topic, --difficulty
    - Query problems using RevisionEngine.getDueProblems with filters
    - Apply AND logic when multiple filters specified
    - Handle no matching problems case with informative message
    - _Requirements: 9.1, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [~] 13.2 Implement interactive review session
    - Display problem information (title, platform, difficulty, tags, notes path)
    - Prompt user to rate understanding (easy, medium, hard, failed) using Inquirer.js
    - Call RevisionEngine to update schedule after each rating
    - Handle user cancellation (save progress for reviewed problems)
    - Display session summary at end (problems reviewed, confidence distribution, next review date)
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ]* 13.3 Write integration test for review session
    - Create test database with due problems
    - Simulate user input for ratings
    - Verify review stats updated correctly
    - Verify next review dates calculated correctly

- [ ] 14. CLI commands - Statistics and search
  - [~] 14.1 Implement stats command
    - Query database for total problems by platform
    - Query problems by difficulty level
    - Query problems by topic
    - Query problems by language
    - Query confidence distribution (weak, medium, strong)
    - Count due problems (next_review_date <= today)
    - Calculate average review count
    - Calculate current streak (consecutive days with reviews)
    - Display formatted output with sections
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [~] 14.2 Implement search command
    - Accept query string as argument
    - Perform case-insensitive partial matching on title, topic, tags
    - Display results with title, platform, difficulty, file path
    - Support opening problem directory or notes file (prompt user)
    - Handle no results case with message
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 14.3 Write unit tests for stats and search
    - Test stats aggregation with sample database
    - Test search matching logic with various queries
    - Test case-insensitive partial matching


- [ ] 15. CLI commands - Sync and configuration
  - [~] 15.1 Implement sync command
    - Pull changes from remote repository using GitService
    - Scan problems directory to rebuild problem list
    - Compare with database records to detect new, updated, deleted problems
    - Update database with new problems (initialize review stats)
    - Preserve existing review stats for unchanged problems
    - Handle merge conflicts (report and instruct manual resolution)
    - Display sync summary (new, updated, deleted counts)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [~] 15.2 Implement config command
    - Without arguments: display current configuration values
    - With key argument: display specific config value
    - With key and value: validate and update configuration
    - Support nested keys with dot notation (e.g., git.remoteUrl)
    - Validate values before saving (URLs, booleans, numbers)
    - Report validation errors with expected format
    - Save updated config to config.json
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
- [x] 15. CLI commands - Sync and configuration
  - [x] 15.1 Implement config command
    - Support get, set, list subcommands
    - Read/write from user's global config file (e.g. ~/.dsa-vault-config.json)
    - Validate settings
  - [x] 15.2 Implement sync command
    - Execute git add, commit, push in the background
    - Provide a default commit message (e.g. "DSA Vault Sync: [Date]")
    - Handle Git remote tracking
    - Show sync status and handles errors cleanly

- [x] 16. CLI commands - Import and maintenance
  - [x] 16.1 Implement doctor command
    - Check database integrity
    - Verify file system sync (all DB problems have files)
    - Check Git status
    - Verify browser connection
    - Print diagnostic report
  - [x] 16.2 Implement import command
    - Accept directory path argument
    - Scan directory recursively for code files
    - For each file, prompt user for missing metadata (platform, title, URL, difficulty, tags, topic)
    - Support JSON manifest files with pre-populated metadata
    - Create ProblemEntry following standard structure for each imported file
    - Skip files that fail validation or user cancels
    - Display import summary (imported count, skipped count)
    - Log errors for skipped files
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [~] 16.2 Implement doctor command
    - Verify workspace directory structure exists (problems/, reviews/, templates/)
    - Verify SQLite database exists and schema is correct
    - Verify Git is installed and repository is initialized
    - Verify Playwright browser binaries are installed
    - If remote configured, verify remote repository is accessible
    - For each check, record pass/fail status and specific issues
    - Display all detected issues with remediation steps
    - Display success message if all checks pass
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

  - [ ]* 16.3 Write unit tests for import and doctor
    - Test import with sample code files
    - Test import with JSON manifest
    - Test doctor checks with missing components
    - Test doctor success case with complete setup


- [~] 17. Checkpoint - Ensure all CLI commands work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Error handling and logging
  - [x] 18.1 Implement structured error types and handlers
    - Create error factory functions for each error type (BrowserError, ExtractionError, etc.)
    - Implement error formatting for user-friendly terminal display
    - Include error codes, messages, and recovery suggestions
    - Implement error recovery suggestions for common failures
    - _Requirements: All error handling requirements_

  - [x] 18.2 Implement structured logging system
    - Create Logger service with levels (ERROR, WARN, INFO, DEBUG)
    - Implement JSON log format with timestamp, level, operation, context
    - Configure log file output (append to workspace/logs/dsa-vault.log)
    - Add console output with color coding for terminal
    - Log key operations: capture start/end, review session, sync, errors
    - _Requirements: Design logging strategy_

  - [x]* 18.3 Write unit tests for error handling
    - Test error factory functions create correct error objects
    - Test error formatting produces user-friendly messages
    - Test recovery suggestions included for relevant errors

- [ ] 19. Integration tests for end-to-end workflows
  - [ ]* 19.1 Write integration test for full capture workflow
    - Create HTML fixture for problem page
    - Set up temporary workspace and database
    - Test complete capture: extract → validate → save → commit
    - Verify all files created with correct content
    - Verify database record created
    - Verify Git commit created

  - [ ]* 19.2 Write integration test for full review workflow
    - Populate test database with problems at various review stages
    - Test review session with filtering
    - Simulate user ratings
    - Verify schedule updates applied correctly
    - Verify confidence scores updated

  - [ ]* 19.3 Write integration test for duplicate handling
    - Capture same problem twice
    - Test each duplicate resolution option (overwrite, merge, skip, new version)
    - Verify files and database state match expected outcome
    - Verify review history preserved appropriately


  - [~] 20.2 Create notes template file
    - Create templates/notes-template.md with all required sections
    - Include placeholders for problem metadata
    - Include sections: Problem, Approach, Complexity, Key Insight, Common Mistakes, Follow-up Problems
    - _Requirements: 4.5, 20.1, 20.2_

  - [~] 20.3 Create setup script for initial configuration
    - Create scripts/setup.sh (or .bat for Windows)
    - Automate npm install, Playwright browser installation
    - Prompt user for Git remote URL (optional)
    - Run init command
    - Provide instructions for browser CDP setup
    - _Requirements: 1.1, 1.2, 1.3_

  - [~] 20.4 Add inline code documentation
    - Add JSDoc comments to all public interfaces and functions
    - Document parameters, return types, error conditions
    - Document complex algorithms (spaced-repetition calculation)
    - Document platform adapter selector strategies
    - _Requirements: Development best practices_

- [~] 21. Final checkpoint and verification
  - Ensure all tests pass, ask the user if questions arise.
  - Run full test suite (unit + property + integration)
  - Verify all correctness properties pass with 100+ iterations
  - Verify code coverage meets targets (80% unit, 100% properties, 70% integration)
  - Test manual end-to-end workflow: init → capture → review → sync
  - Verify error messages are clear and actionable
  - Verify CLI help text is complete and accurate

## Notes

- Tasks marked with `*` are optional test-related sub-tasks and can be skipped for faster MVP
- Property-based tests validate universal correctness properties from the design document
- Each task references specific requirements for traceability
- The implementation uses TypeScript as specified in the design document
- Checkpoints ensure incremental validation and allow for user feedback
- Testing uses Vitest for unit/integration tests and fast-check for property-based tests
- All 13 correctness properties from the design have dedicated property test sub-tasks
- Integration tests use temporary directories, in-memory databases, and HTML fixtures
- Browser automation tests use Playwright with local HTML fixtures to avoid external dependencies


## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2"]
    },
    {
      "id": 1,
      "tasks": ["2.1", "2.2", "3.1"]
    },
    {
      "id": 2,
      "tasks": ["2.3", "3.2", "3.4", "3.6"]
    },
    {
      "id": 3,
      "tasks": ["3.3", "3.5", "3.7", "4.1", "4.7", "4.9"]
    },
    {
      "id": 4,
      "tasks": ["4.2", "4.3", "4.8", "4.10"]
    },
    {
      "id": 5,
      "tasks": ["4.4", "4.5", "4.6"]
    },
    {
      "id": 6,
      "tasks": ["6.1"]
    },
    {
      "id": 7,
      "tasks": ["6.2", "6.3"]
    },
    {
      "id": 8,
      "tasks": ["6.4", "7.1", "9.1", "9.3", "9.5"]
    },
    {
      "id": 9,
      "tasks": ["7.2", "7.6", "9.2", "9.4", "9.6"]
    },
    {
      "id": 10,
      "tasks": ["7.3", "7.4", "9.7"]
    },
    {
      "id": 11,
      "tasks": ["7.5", "9.8"]
    },
    {
      "id": 12,
      "tasks": ["11.1"]
    },
    {
      "id": 13,
      "tasks": ["11.2", "18.1", "18.2"]
    },
    {
      "id": 14,
      "tasks": ["11.3", "12.1", "18.3"]
    },
    {
      "id": 15,
      "tasks": ["12.2", "13.1"]
    },
    {
      "id": 16,
      "tasks": ["13.2"]
    },
    {
      "id": 17,
      "tasks": ["13.3", "14.1", "14.2"]
    },
    {
      "id": 18,
      "tasks": ["14.3", "15.1", "15.2"]
    },
    {
      "id": 19,
      "tasks": ["15.3", "16.1", "16.2"]
    },
    {
      "id": 20,
      "tasks": ["16.3", "19.1", "19.2", "19.3", "19.4"]
    },
    {
      "id": 21,
      "tasks": ["20.1", "20.2", "20.3", "20.4"]
    }
  ]
}
```
