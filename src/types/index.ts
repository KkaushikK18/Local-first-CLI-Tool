/**
 * Core Type Definitions for DSA Vault
 */

import { z } from 'zod';

// ============================================================================
// Basic Enums and Types
// ============================================================================

export const PlatformNameSchema = z.enum(['leetcode', 'geeksforgeeks']);
export type PlatformName = z.infer<typeof PlatformNameSchema>;

export const DifficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const ProblemStatusSchema = z.enum(['solved', 'attempted', 'reviewed']);
export type ProblemStatus = z.infer<typeof ProblemStatusSchema>;

export const ReviewOutcomeSchema = z.enum(['easy', 'medium', 'hard', 'failed']);
export type ReviewOutcome = z.infer<typeof ReviewOutcomeSchema>;

export const ConfidenceLevelSchema = z.enum(['weak', 'medium', 'strong']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

// ============================================================================
// Domain Models with Zod Schemas
// ============================================================================

/**
 * Problem Metadata Schema
 * Validates: Requirements 19.1, 19.2, 19.3
 */
export const ProblemMetadataSchema = z.object({
  platform: PlatformNameSchema,
  title: z.string().min(1, 'Title cannot be empty'),
  url: z.string().url('Must be a valid URL'),
  difficulty: DifficultySchema,
  tags: z.array(z.string()),
  topic: z.string().default('uncategorized'),
  description: z.string(),
  language: z.string().min(1, 'Language cannot be empty'),
  dateSolved: z.date(),
  status: ProblemStatusSchema.default('solved'),
});

export type ProblemMetadata = z.infer<typeof ProblemMetadataSchema>;

/**
 * Solution Schema
 */
export const SolutionSchema = z.object({
  code: z.string().min(1, 'Code cannot be empty'),
  language: z.string().min(1, 'Language cannot be empty'),
  languageExtension: z.string().regex(/^\.\w+$/, 'Extension must start with a dot'),
});

export type Solution = z.infer<typeof SolutionSchema>;

/**
 * Review Statistics Schema
 */
export const ReviewStatsSchema = z.object({
  firstSolvedDate: z.date(),
  lastReviewedDate: z.date().nullable(),
  nextReviewDate: z.date(),
  reviewCount: z.number().int().min(0),
  confidenceScore: ConfidenceLevelSchema,
  mistakeCount: z.number().int().min(0),
  easeFactor: z.number().min(1.3).max(3.0),
  currentInterval: z.number().min(0),
});

export type ReviewStats = z.infer<typeof ReviewStatsSchema>;

/**
 * Problem Entry Schema
 */
export const ProblemEntrySchema = z.object({
  id: z.string().uuid(),
  metadata: ProblemMetadataSchema,
  solution: SolutionSchema,
  notes: z.string(),
  filePath: z.string().min(1),
  reviewStats: ReviewStatsSchema,
});

export type ProblemEntry = z.infer<typeof ProblemEntrySchema>;

/**
 * Review History Type
 * Used for calculating confidence scores
 */
export const ReviewHistorySchema = z.object({
  reviewCount: z.number().int().min(0),
  mistakeCount: z.number().int().min(0),
  recentOutcomes: z.array(ReviewOutcomeSchema),
});

export type ReviewHistory = z.infer<typeof ReviewHistorySchema>;

/**
 * Configuration Schema
 */
export const ConfigSchema = z.object({
  git: z.object({
    remoteUrl: z.string().url().nullable(),
    autoPush: z.boolean(),
    branch: z.string().min(1),
  }),
  editor: z.object({
    command: z.string().min(1),
  }),
  browser: z.object({
    cdpUrl: z.string().url(),
    profile: z.string().nullable(),
  }),
  spacedRepetition: z.object({
    easyMultiplier: z.number().min(1.0).max(10.0),
    mediumMultiplier: z.number().min(1.0).max(10.0),
    hardMultiplier: z.number().min(0.1).max(10.0),
    maxInterval: z.number().int().min(1).max(365),
  }),
  defaults: z.object({
    platform: z.enum(['leetcode', 'geeksforgeeks']).nullable(),
    language: z.string().nullable(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

// ============================================================================
// Error Types (Discriminated Union)
// ============================================================================

/**
 * Base error type for all DSA Vault errors
 */
export interface BaseError {
  readonly _tag: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

/**
 * Validation Error - when data fails schema validation
 */
export interface ValidationError extends BaseError {
  readonly _tag: 'ValidationError';
  readonly fieldErrors: Record<string, string[]>;
}

/**
 * Extraction Error - when browser automation fails to extract data
 */
export interface ExtractionError extends BaseError {
  readonly _tag: 'ExtractionError';
  readonly platform: PlatformName;
  readonly missingFields: string[];
}

/**
 * Authentication Error - when user is not logged into platform
 */
export interface AuthenticationError extends BaseError {
  readonly _tag: 'AuthenticationError';
  readonly platform: PlatformName;
}

/**
 * Database Error - when SQLite operations fail
 */
export interface DatabaseError extends BaseError {
  readonly _tag: 'DatabaseError';
  readonly operation: 'insert' | 'update' | 'query' | 'delete' | 'initialize';
  readonly cause?: Error;
}

/**
 * File System Error - when file operations fail
 */
export interface FileSystemError extends BaseError {
  readonly _tag: 'FileSystemError';
  readonly operation: 'read' | 'write' | 'delete' | 'create';
  readonly path: string;
  readonly cause?: Error;
}

/**
 * Git Error - when Git operations fail
 */
export interface GitError extends BaseError {
  readonly _tag: 'GitError';
  readonly operation: 'init' | 'add' | 'commit' | 'push' | 'pull' | 'clone';
  readonly cause?: Error;
}

/**
 * Browser Error - when browser automation fails
 */
export interface BrowserError extends BaseError {
  readonly _tag: 'BrowserError';
  readonly operation: 'connect' | 'navigate' | 'extract' | 'authenticate';
  readonly cause?: Error;
}

/**
 * Duplicate Error - when problem URL already exists
 */
export interface DuplicateError extends BaseError {
  readonly _tag: 'DuplicateError';
  readonly url: string;
  readonly existingProblemId: string;
}

/**
 * Configuration Error - when configuration is invalid or missing
 */
export interface ConfigurationError extends BaseError {
  readonly _tag: 'ConfigurationError';
  readonly configKey: string;
}

/**
 * Not Found Error - when a requested resource doesn't exist
 */
export interface NotFoundError extends BaseError {
  readonly _tag: 'NotFoundError';
  readonly resourceType: 'problem' | 'file' | 'workspace' | 'config';
  readonly identifier: string;
}

/**
 * DSA Vault Error - Discriminated union of all error types
 * Enables exhaustive pattern matching and type-safe error handling
 */
export type DSAVaultError =
  | ValidationError
  | ExtractionError
  | AuthenticationError
  | DatabaseError
  | FileSystemError
  | GitError
  | BrowserError
  | DuplicateError
  | ConfigurationError
  | NotFoundError;

// ============================================================================
// Error Constructors
// ============================================================================

export const createValidationError = (
  message: string,
  fieldErrors: Record<string, string[]>,
  context?: Record<string, unknown>
): ValidationError => ({
  _tag: 'ValidationError',
  message,
  fieldErrors,
  context,
});

export const createExtractionError = (
  message: string,
  platform: PlatformName,
  missingFields: string[],
  context?: Record<string, unknown>
): ExtractionError => ({
  _tag: 'ExtractionError',
  message,
  platform,
  missingFields,
  context,
});

export const createAuthenticationError = (
  message: string,
  platform: PlatformName,
  context?: Record<string, unknown>
): AuthenticationError => ({
  _tag: 'AuthenticationError',
  message,
  platform,
  context,
});

export const createDatabaseError = (
  message: string,
  operation: DatabaseError['operation'],
  cause?: Error,
  context?: Record<string, unknown>
): DatabaseError => ({
  _tag: 'DatabaseError',
  message,
  operation,
  cause,
  context,
});

export const createFileSystemError = (
  message: string,
  operation: FileSystemError['operation'],
  path: string,
  cause?: Error,
  context?: Record<string, unknown>
): FileSystemError => ({
  _tag: 'FileSystemError',
  message,
  operation,
  path,
  cause,
  context,
});

export const createGitError = (
  message: string,
  operation: GitError['operation'],
  cause?: Error,
  context?: Record<string, unknown>
): GitError => ({
  _tag: 'GitError',
  message,
  operation,
  cause,
  context,
});

export const createBrowserError = (
  message: string,
  operation: BrowserError['operation'],
  cause?: Error,
  context?: Record<string, unknown>
): BrowserError => ({
  _tag: 'BrowserError',
  message,
  operation,
  cause,
  context,
});

export const createDuplicateError = (
  message: string,
  url: string,
  existingProblemId: string,
  context?: Record<string, unknown>
): DuplicateError => ({
  _tag: 'DuplicateError',
  message,
  url,
  existingProblemId,
  context,
});

export const createConfigurationError = (
  message: string,
  configKey: string,
  context?: Record<string, unknown>
): ConfigurationError => ({
  _tag: 'ConfigurationError',
  message,
  configKey,
  context,
});

export const createNotFoundError = (
  message: string,
  resourceType: NotFoundError['resourceType'],
  identifier: string,
  context?: Record<string, unknown>
): NotFoundError => ({
  _tag: 'NotFoundError',
  message,
  resourceType,
  identifier,
  context,
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate ProblemMetadata with detailed error reporting
 * Validates: Requirements 19.1, 19.2, 19.3
 */
export const validateProblemMetadata = (
  data: unknown
): { success: true; data: ProblemMetadata } | { success: false; error: ValidationError } => {
  const result = ProblemMetadataSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const fieldErrors: Record<string, string[]> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(err.message);
  });
  
  return {
    success: false,
    error: createValidationError(
      'Problem metadata validation failed',
      fieldErrors,
      { data }
    ),
  };
};

/**
 * Validate Solution data
 */
export const validateSolution = (
  data: unknown
): { success: true; data: Solution } | { success: false; error: ValidationError } => {
  const result = SolutionSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const fieldErrors: Record<string, string[]> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(err.message);
  });
  
  return {
    success: false,
    error: createValidationError(
      'Solution validation failed',
      fieldErrors,
      { data }
    ),
  };
};

/**
 * Validate ProblemEntry
 */
export const validateProblemEntry = (
  data: unknown
): { success: true; data: ProblemEntry } | { success: false; error: ValidationError } => {
  const result = ProblemEntrySchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const fieldErrors: Record<string, string[]> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(err.message);
  });
  
  return {
    success: false,
    error: createValidationError(
      'Problem entry validation failed',
      fieldErrors,
      { data }
    ),
  };
};

/**
 * Validate Configuration
 */
export const validateConfig = (
  data: unknown
): { success: true; data: Config } | { success: false; error: ValidationError } => {
  const result = ConfigSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const fieldErrors: Record<string, string[]> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(err.message);
  });
  
  return {
    success: false,
    error: createValidationError(
      'Configuration validation failed',
      fieldErrors,
      { data }
    ),
  };
};

/**
 * Validate ReviewStats
 */
export const validateReviewStats = (
  data: unknown
): { success: true; data: ReviewStats } | { success: false; error: ValidationError } => {
  const result = ReviewStatsSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const fieldErrors: Record<string, string[]> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(err.message);
  });
  
  return {
    success: false,
    error: createValidationError(
      'Review stats validation failed',
      fieldErrors,
      { data }
    ),
  };
};

/**
 * Validate notes content (non-empty, no whitespace-only)
 * Validates: Requirements 4.2
 */
export const validateNotes = (notes: string): { valid: true } | { valid: false; error: ValidationError } => {
  const trimmed = notes.trim();
  
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: createValidationError(
        'Notes cannot be empty or contain only whitespace',
        { notes: ['Notes must contain meaningful content'] },
        { originalLength: notes.length, trimmedLength: trimmed.length }
      ),
    };
  }
  
  return { valid: true };
};

// ============================================================================
// Helper Type Guards
// ============================================================================

export const isValidationError = (error: DSAVaultError): error is ValidationError =>
  error._tag === 'ValidationError';

export const isExtractionError = (error: DSAVaultError): error is ExtractionError =>
  error._tag === 'ExtractionError';

export const isAuthenticationError = (error: DSAVaultError): error is AuthenticationError =>
  error._tag === 'AuthenticationError';

export const isDatabaseError = (error: DSAVaultError): error is DatabaseError =>
  error._tag === 'DatabaseError';

export const isFileSystemError = (error: DSAVaultError): error is FileSystemError =>
  error._tag === 'FileSystemError';

export const isGitError = (error: DSAVaultError): error is GitError =>
  error._tag === 'GitError';

export const isBrowserError = (error: DSAVaultError): error is BrowserError =>
  error._tag === 'BrowserError';

export const isDuplicateError = (error: DSAVaultError): error is DuplicateError =>
  error._tag === 'DuplicateError';

export const isConfigurationError = (error: DSAVaultError): error is ConfigurationError =>
  error._tag === 'ConfigurationError';

export const isNotFoundError = (error: DSAVaultError): error is NotFoundError =>
  error._tag === 'NotFoundError';
