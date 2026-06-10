# Requirements Document

## Introduction

DSA Vault is a local-first desktop/CLI tool that automatically captures solved coding problems from LeetCode and GeeksforGeeks, stores the accepted code and revision notes in a structured GitHub repository, and generates spaced-repetition revision sessions for later review. The tool implements a complete workflow from problem capture through structured storage to intelligent revision scheduling, minimizing manual effort while maximizing retention and practice effectiveness.

## Glossary

- **DSA_Vault**: The local-first CLI/desktop application that manages problem capture, storage, and revision
- **Problem_Capture_Engine**: The subsystem that orchestrates the solve-to-save workflow
- **Platform_Adapter**: A module that implements platform-specific logic for LeetCode or GeeksforGeeks
- **Revision_Engine**: The subsystem that implements spaced-repetition scheduling and review session management
- **Storage_Layer**: The combined SQLite database, Markdown files, and Git repository storage system
- **Problem_Metadata**: Structured data about a problem including platform, title, URL, difficulty, tags, language, date solved, and status
- **Accepted_Solution**: User-submitted code that passed all test cases on the original platform
- **Revision_Session**: An interactive CLI session that presents due problems for review
- **Confidence_Score**: A numeric value representing user mastery of a specific problem (weak/medium/strong)
- **Review_Schedule**: The spaced-repetition schedule tracking next review dates for each problem
- **Problem_Entry**: A complete record consisting of code file, notes file, metadata file, and database record
- **Git_Repository**: The local and optionally remote GitHub repository containing all problem entries
- **Browser_Automation**: Playwright-based detection and extraction of problem data from web pages
- **CLI_Interface**: The command-line interface exposing all DSA_Vault commands
- **Capture_Command**: The primary command that detects, extracts, and saves a solved problem
- **Review_Command**: The command that initiates a filtered revision session
- **Due_Problem**: A problem whose next review date is today or earlier
- **Weak_Problem**: A problem with low confidence score or high mistake count
- **Problem_Repository_Structure**: The hierarchical folder organization: problems/{platform}/{topic}/{problem-name}/

## Requirements

### Requirement 1: Initialize DSA Vault Workspace

**User Story:** As a user, I want to initialize a DSA Vault workspace, so that I can start capturing and managing solved problems.

#### Acceptance Criteria

1. WHEN the user executes the init command, THE DSA_Vault SHALL create the Problem_Repository_Structure with problems, reviews, templates, scripts, and src directories
2. WHEN the user executes the init command, THE DSA_Vault SHALL initialize a Git_Repository in the workspace root
3. WHEN the user executes the init command, THE DSA_Vault SHALL create an SQLite database file in the reviews directory
4. WHEN the user executes the init command, THE DSA_Vault SHALL create a default notes-template.md file in the templates directory
5. WHEN the workspace already exists, THE DSA_Vault SHALL report the existing workspace and exit without modification
6. WHEN Git initialization fails, THE DSA_Vault SHALL report the error and provide remediation instructions

### Requirement 2: Capture LeetCode Problems

**User Story:** As a user, I want to capture a solved LeetCode problem automatically, so that I can save the code and notes without manual data entry.

#### Acceptance Criteria

1. WHEN the user executes the capture command with a LeetCode problem open in the browser, THE Platform_Adapter SHALL extract Problem_Metadata including title, URL, difficulty, tags, and problem description
2. WHEN the user executes the capture command with a LeetCode problem open in the browser, THE Platform_Adapter SHALL extract the Accepted_Solution code and language
3. WHEN the user provides a LeetCode URL via command argument, THE Platform_Adapter SHALL navigate to the URL and extract Problem_Metadata and Accepted_Solution
4. WHEN LeetCode problem data cannot be extracted, THE Platform_Adapter SHALL report the specific extraction failure and exit
5. WHEN multiple browser tabs contain LeetCode problems, THE Platform_Adapter SHALL prompt the user to select the correct tab
6. WHEN the user is not logged into LeetCode, THE Platform_Adapter SHALL detect the authentication failure and prompt the user to log in

### Requirement 3: Capture GeeksforGeeks Problems

**User Story:** As a user, I want to capture a solved GeeksforGeeks problem automatically, so that I can save the code and notes without manual data entry.

#### Acceptance Criteria

1. WHEN the user executes the capture command with a GeeksforGeeks problem open in the browser, THE Platform_Adapter SHALL extract Problem_Metadata including title, URL, difficulty, tags, and problem description
2. WHEN the user executes the capture command with a GeeksforGeeks problem open in the browser, THE Platform_Adapter SHALL extract the Accepted_Solution code and language
3. WHEN the user provides a GeeksforGeeks URL via command argument, THE Platform_Adapter SHALL navigate to the URL and extract Problem_Metadata and Accepted_Solution
4. WHEN GeeksforGeeks problem data cannot be extracted, THE Platform_Adapter SHALL report the specific extraction failure and exit
5. WHEN multiple browser tabs contain GeeksforGeeks problems, THE Platform_Adapter SHALL prompt the user to select the correct tab
6. WHEN the user is not logged into GeeksforGeeks, THE Platform_Adapter SHALL detect the authentication failure and prompt the user to log in

### Requirement 4: Collect Problem Notes

**User Story:** As a user, I want to add compact notes after solving a problem, so that I can capture key insights, approaches, and mistakes for future review.

#### Acceptance Criteria

1. WHEN Problem_Metadata and Accepted_Solution are captured, THE Problem_Capture_Engine SHALL prompt the user for notes using an interactive editor
2. WHEN the user provides notes, THE Problem_Capture_Engine SHALL validate that notes are non-empty
3. WHEN the user saves notes, THE Problem_Capture_Engine SHALL populate the notes-template.md with problem context, approach, complexity, mistakes, and review hints
4. WHEN the user cancels note entry, THE Problem_Capture_Engine SHALL prompt for confirmation before proceeding without notes
5. THE Problem_Capture_Engine SHALL include sections for time complexity, space complexity, key insight, approach, common mistakes, and follow-up problems in the notes template

### Requirement 5: Store Problem Entries in Repository

**User Story:** As a user, I want captured problems stored in a clean folder structure, so that I can browse and organize problems by platform and topic.

#### Acceptance Criteria

1. WHEN a Problem_Entry is saved, THE Storage_Layer SHALL create a directory following the pattern problems/{platform}/{topic}/{problem-name}/
2. WHEN a Problem_Entry is saved, THE Storage_Layer SHALL write the Accepted_Solution to a file named solution.{extension} where extension matches the language
3. WHEN a Problem_Entry is saved, THE Storage_Layer SHALL write the user notes to a file named notes.md
4. WHEN a Problem_Entry is saved, THE Storage_Layer SHALL write Problem_Metadata to a file named meta.json
5. WHEN a problem with the same name already exists, THE Storage_Layer SHALL prompt the user to overwrite, skip, or rename
6. WHEN the topic is not provided in Problem_Metadata, THE Storage_Layer SHALL use "uncategorized" as the topic directory
7. THE Storage_Layer SHALL sanitize problem names to create filesystem-safe directory names

### Requirement 6: Store Problem Metadata in Database

**User Story:** As a user, I want problem metadata stored in a searchable database, so that I can quickly query and filter problems.

#### Acceptance Criteria

1. WHEN a Problem_Entry is saved, THE Storage_Layer SHALL insert a record into the SQLite database with platform, title, URL, difficulty, tags, language, date_solved, and file_path
2. WHEN a Problem_Entry is saved, THE Storage_Layer SHALL initialize revision tracking fields including first_solved_date, last_reviewed_date, next_review_date, review_count, confidence_score, and mistake_count
3. WHEN a problem with the same URL already exists in the database, THE Storage_Layer SHALL update the existing record instead of creating a duplicate
4. WHEN database insertion fails, THE Storage_Layer SHALL report the error and preserve the file-based Problem_Entry
5. THE Storage_Layer SHALL set next_review_date to one day after date_solved for new problems
6. THE Storage_Layer SHALL set initial confidence_score to 0 and review_count to 0 for new problems

### Requirement 7: Commit and Push to GitHub

**User Story:** As a user, I want captured problems automatically committed and pushed to GitHub, so that my work is backed up without manual Git operations.

#### Acceptance Criteria

1. WHEN a Problem_Entry is saved, THE Storage_Layer SHALL stage all new and modified files using git add
2. WHEN files are staged, THE Storage_Layer SHALL create a commit with message format "Add {platform} problem: {title}"
3. WHEN a commit is created, THE Storage_Layer SHALL push to the remote repository if a remote is configured
4. WHEN no remote repository is configured, THE Storage_Layer SHALL skip the push operation and log an informational message
5. WHEN a push operation fails due to conflicts, THE Storage_Layer SHALL report the conflict and instruct the user to resolve manually
6. WHEN a push operation fails due to network issues, THE Storage_Layer SHALL report the error and confirm that local files are saved
7. WHERE the user has configured auto-push to false, THE Storage_Layer SHALL create the commit but skip the push operation

### Requirement 8: Generate Revision Schedule

**User Story:** As a user, I want problems automatically added to a spaced-repetition schedule, so that I can review problems at optimal intervals.

#### Acceptance Criteria

1. WHEN a Problem_Entry is first saved, THE Revision_Engine SHALL calculate next_review_date as one day after date_solved
2. WHEN a problem is reviewed with outcome "easy", THE Revision_Engine SHALL multiply the current interval by 2.5 and update next_review_date
3. WHEN a problem is reviewed with outcome "medium", THE Revision_Engine SHALL multiply the current interval by 1.5 and update next_review_date
4. WHEN a problem is reviewed with outcome "hard", THE Revision_Engine SHALL reset the interval to one day and update next_review_date
5. WHEN a problem is reviewed with outcome "failed", THE Revision_Engine SHALL reset the interval to one day, increment mistake_count, and set confidence_score to weak
6. WHEN review_count exceeds 5 and all recent outcomes are "easy", THE Revision_Engine SHALL set confidence_score to strong
7. WHEN mistake_count exceeds 2, THE Revision_Engine SHALL set confidence_score to weak
8. THE Revision_Engine SHALL update last_reviewed_date and increment review_count after each review

### Requirement 9: Conduct Revision Sessions

**User Story:** As a user, I want to review due problems in an interactive session, so that I can practice and strengthen my understanding.

#### Acceptance Criteria

1. WHEN the user executes the review command, THE CLI_Interface SHALL query Due_Problems and present them in a review session
2. WHEN a review session is active, THE CLI_Interface SHALL display the problem title, platform, difficulty, tags, and notes file path
3. WHEN a problem is displayed, THE CLI_Interface SHALL prompt the user to rate their understanding as "easy", "medium", "hard", or "failed"
4. WHEN the user provides a rating, THE CLI_Interface SHALL invoke the Revision_Engine to update the Review_Schedule
5. WHEN all Due_Problems are reviewed, THE CLI_Interface SHALL display a summary including problems reviewed, confidence distribution, and next review date
6. WHEN the user cancels a review session, THE CLI_Interface SHALL save progress for reviewed problems and exit
7. WHERE the user specifies the --due flag, THE CLI_Interface SHALL filter the session to include only Due_Problems

### Requirement 10: Filter Revision Sessions

**User Story:** As a user, I want to filter revision sessions by topic, platform, difficulty, or confidence, so that I can focus on specific areas.

#### Acceptance Criteria

1. WHERE the user specifies --weak flag, THE CLI_Interface SHALL filter the session to include only Weak_Problems
2. WHERE the user specifies --topic flag, THE CLI_Interface SHALL filter the session to include only problems matching the specified topic
3. WHERE the user specifies --platform flag, THE CLI_Interface SHALL filter the session to include only problems from the specified platform
4. WHERE the user specifies --difficulty flag, THE CLI_Interface SHALL filter the session to include only problems matching the specified difficulty
5. WHERE multiple filters are specified, THE CLI_Interface SHALL apply all filters using AND logic
6. WHEN no problems match the specified filters, THE CLI_Interface SHALL display a message indicating no problems are available

### Requirement 11: Display Statistics

**User Story:** As a user, I want to view statistics about my captured problems and review progress, so that I can track my learning journey.

#### Acceptance Criteria

1. WHEN the user executes the stats command, THE CLI_Interface SHALL display total problems captured grouped by platform
2. WHEN the user executes the stats command, THE CLI_Interface SHALL display problem count grouped by difficulty level
3. WHEN the user executes the stats command, THE CLI_Interface SHALL display problem count grouped by topic
4. WHEN the user executes the stats command, THE CLI_Interface SHALL display problem count grouped by language
5. WHEN the user executes the stats command, THE CLI_Interface SHALL display confidence distribution (weak, medium, strong)
6. WHEN the user executes the stats command, THE CLI_Interface SHALL display count of Due_Problems
7. WHEN the user executes the stats command, THE CLI_Interface SHALL display average review count across all problems
8. WHEN the user executes the stats command, THE CLI_Interface SHALL display the current streak (consecutive days with reviews)

### Requirement 12: Search Problems

**User Story:** As a user, I want to search for problems by title, topic, or tags, so that I can quickly locate specific problems.

#### Acceptance Criteria

1. WHEN the user executes the search command with a query, THE CLI_Interface SHALL query the database for problems matching the query in title, topic, or tags fields
2. WHEN search results are found, THE CLI_Interface SHALL display a list with problem title, platform, difficulty, and file path
3. WHEN search results are found, THE CLI_Interface SHALL support opening the problem directory or notes file
4. WHEN no search results are found, THE CLI_Interface SHALL display a message indicating no matches
5. THE CLI_Interface SHALL perform case-insensitive partial matching for search queries

### Requirement 13: Import External Problem Collections

**User Story:** As a user, I want to import problem collections from external sources, so that I can migrate existing solutions into DSA Vault.

#### Acceptance Criteria

1. WHEN the user executes the import command with a directory path, THE DSA_Vault SHALL scan the directory for code files and metadata
2. WHEN code files are found, THE DSA_Vault SHALL prompt the user to provide missing Problem_Metadata for each file
3. WHEN Problem_Metadata is provided, THE DSA_Vault SHALL create Problem_Entries following the standard structure
4. WHEN import completes, THE DSA_Vault SHALL display a summary of imported problems and any skipped files
5. THE DSA_Vault SHALL support importing from JSON manifests that include Problem_Metadata
6. WHEN import encounters errors, THE DSA_Vault SHALL log the error and continue processing remaining files

### Requirement 14: Configure DSA Vault Settings

**User Story:** As a user, I want to configure DSA Vault settings, so that I can customize behavior to match my workflow.

#### Acceptance Criteria

1. WHEN the user executes the config command, THE CLI_Interface SHALL display current configuration values
2. WHEN the user sets a configuration value, THE CLI_Interface SHALL validate the value and update the configuration file
3. THE CLI_Interface SHALL support configuring Git remote URL, auto-push behavior, default editor, and browser profile
4. THE CLI_Interface SHALL support configuring spaced-repetition intervals (easy, medium, hard multipliers)
5. WHEN configuration values are invalid, THE CLI_Interface SHALL report the validation error and reject the change
6. THE CLI_Interface SHALL store configuration in a config.json file in the workspace root

### Requirement 15: Synchronize Local and Remote Repositories

**User Story:** As a user, I want to synchronize my local repository with the remote, so that I can keep multiple machines in sync.

#### Acceptance Criteria

1. WHEN the user executes the sync command, THE DSA_Vault SHALL pull changes from the remote repository
2. WHEN the user executes the sync command, THE DSA_Vault SHALL rebuild the SQLite database from the Problem_Repository_Structure
3. WHEN sync completes, THE DSA_Vault SHALL display a summary of new, updated, and deleted problems
4. WHEN merge conflicts occur during pull, THE DSA_Vault SHALL report the conflicts and instruct the user to resolve manually
5. WHEN the database is rebuilt, THE DSA_Vault SHALL preserve existing review statistics for unchanged problems
6. WHEN new problems are detected, THE DSA_Vault SHALL initialize revision tracking fields with default values

### Requirement 16: Diagnose Installation and Configuration

**User Story:** As a user, I want to diagnose my DSA Vault installation, so that I can identify and fix configuration issues.

#### Acceptance Criteria

1. WHEN the user executes the doctor command, THE DSA_Vault SHALL verify the workspace structure exists
2. WHEN the user executes the doctor command, THE DSA_Vault SHALL verify the SQLite database is readable and schema is correct
3. WHEN the user executes the doctor command, THE DSA_Vault SHALL verify Git is installed and repository is initialized
4. WHEN the user executes the doctor command, THE DSA_Vault SHALL verify Playwright browser binaries are installed
5. WHEN the user executes the doctor command, THE DSA_Vault SHALL verify the remote repository is accessible if configured
6. WHEN the user executes the doctor command, THE DSA_Vault SHALL report all detected issues with suggested remediation steps
7. WHEN all checks pass, THE DSA_Vault SHALL display a success message confirming the installation is healthy

### Requirement 17: Handle Duplicate Problem Captures

**User Story:** As a user, I want duplicate problem captures handled safely, so that I can re-capture problems without losing previous notes or review history.

#### Acceptance Criteria

1. WHEN a problem URL already exists in the database, THE Problem_Capture_Engine SHALL detect the duplicate before file creation
2. WHEN a duplicate is detected, THE Problem_Capture_Engine SHALL prompt the user with options: overwrite, merge notes, skip, or create new version
3. WHEN the user selects overwrite, THE Problem_Capture_Engine SHALL replace the Accepted_Solution and append new notes to existing notes
4. WHEN the user selects merge notes, THE Problem_Capture_Engine SHALL preserve the existing Accepted_Solution and append new notes
5. WHEN the user selects skip, THE Problem_Capture_Engine SHALL exit without modifying existing files or database records
6. WHEN the user selects create new version, THE Problem_Capture_Engine SHALL append a version suffix to the problem directory name
7. THE Problem_Capture_Engine SHALL preserve review history (review_count, confidence_score, mistake_count) for all duplicate handling options except create new version

### Requirement 18: Parse Problem Metadata from Platform Pages

**User Story:** As a developer, I want to parse structured problem metadata from platform pages, so that accurate Problem_Metadata can be extracted reliably.

#### Acceptance Criteria

1. WHEN a Platform_Adapter parses a problem page, THE DSA_Vault SHALL extract the problem title from the page DOM
2. WHEN a Platform_Adapter parses a problem page, THE DSA_Vault SHALL extract difficulty level (Easy, Medium, Hard) from the page DOM
3. WHEN a Platform_Adapter parses a problem page, THE DSA_Vault SHALL extract topic tags from the page DOM
4. WHEN a Platform_Adapter parses a problem page, THE DSA_Vault SHALL extract the problem description text
5. WHEN a Platform_Adapter parses a problem page, THE DSA_Vault SHALL extract the accepted solution code from the code editor
6. WHEN a Platform_Adapter parses a problem page, THE DSA_Vault SHALL extract the programming language from the language selector
7. WHEN required metadata fields are missing, THE Platform_Adapter SHALL report the specific missing fields and exit

### Requirement 19: Format Problem Metadata Files

**User Story:** As a developer, I want to format Problem_Metadata files consistently, so that metadata can be parsed and displayed reliably.

#### Acceptance Criteria

1. THE Storage_Layer SHALL serialize Problem_Metadata to meta.json using JSON format with 2-space indentation
2. THE Storage_Layer SHALL include fields: platform, title, url, difficulty, tags, language, dateSolved, status, topic
3. THE Storage_Layer SHALL validate Problem_Metadata against a schema before serialization
4. WHEN validation fails, THE Storage_Layer SHALL report the validation errors and reject the Problem_Entry
5. FOR ALL valid Problem_Metadata objects, parsing the serialized meta.json SHALL produce an equivalent object (round-trip property)

### Requirement 20: Format Notes Files

**User Story:** As a developer, I want to format notes files consistently, so that notes are readable and structured.

#### Acceptance Criteria

1. THE Problem_Capture_Engine SHALL serialize notes to notes.md using Markdown format
2. THE Problem_Capture_Engine SHALL include sections: Problem, Approach, Complexity, Key Insight, Common Mistakes, Follow-up Problems
3. THE Problem_Capture_Engine SHALL populate the Problem section with title, platform, difficulty, and URL
4. THE Problem_Capture_Engine SHALL populate the Complexity section with time and space complexity placeholders
5. THE Problem_Capture_Engine SHALL generate the notes file from the notes-template.md template

