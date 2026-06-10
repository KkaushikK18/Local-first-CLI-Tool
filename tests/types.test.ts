import { describe, it, expect } from 'vitest';
import {
  PlatformNameSchema,
  DifficultySchema,
  ProblemStatusSchema,
  ReviewOutcomeSchema,
  ConfidenceLevelSchema,
  ProblemMetadataSchema,
  SolutionSchema,
  ReviewStatsSchema,
  ProblemEntrySchema,
  ConfigSchema,
  ReviewHistorySchema,
  validateProblemMetadata,
  validateSolution,
  validateProblemEntry,
  validateConfig,
  validateReviewStats,
  validateNotes,
  createValidationError,
  createExtractionError,
  createAuthenticationError,
  createDatabaseError,
  createFileSystemError,
  createGitError,
  createBrowserError,
  createDuplicateError,
  createConfigurationError,
  createNotFoundError,
  isValidationError,
  isExtractionError,
  isAuthenticationError,
  isDatabaseError,
  isFileSystemError,
  isGitError,
  isBrowserError,
  isDuplicateError,
  isConfigurationError,
  isNotFoundError,
  type ProblemMetadata,
  type Solution,
  type ReviewStats,
  type ProblemEntry,
  type Config,
  type DSAVaultError,
} from '../src/types/index.js';

import fc from 'fast-check';

describe('DSA Vault Types', () => {
  describe('Basic Enum Schemas', () => {
    it('should validate PlatformName', () => {
      expect(PlatformNameSchema.parse('leetcode')).toBe('leetcode');
      expect(PlatformNameSchema.parse('geeksforgeeks')).toBe('geeksforgeeks');
      expect(() => PlatformNameSchema.parse('invalid')).toThrow();
    });

    it('should validate Difficulty', () => {
      expect(DifficultySchema.parse('Easy')).toBe('Easy');
      expect(DifficultySchema.parse('Medium')).toBe('Medium');
      expect(DifficultySchema.parse('Hard')).toBe('Hard');
      expect(() => DifficultySchema.parse('VeryHard')).toThrow();
    });

    it('should validate ProblemStatus', () => {
      expect(ProblemStatusSchema.parse('solved')).toBe('solved');
      expect(ProblemStatusSchema.parse('attempted')).toBe('attempted');
      expect(ProblemStatusSchema.parse('reviewed')).toBe('reviewed');
      expect(() => ProblemStatusSchema.parse('pending')).toThrow();
    });

    it('should validate ReviewOutcome', () => {
      expect(ReviewOutcomeSchema.parse('easy')).toBe('easy');
      expect(ReviewOutcomeSchema.parse('medium')).toBe('medium');
      expect(ReviewOutcomeSchema.parse('hard')).toBe('hard');
      expect(ReviewOutcomeSchema.parse('failed')).toBe('failed');
      expect(() => ReviewOutcomeSchema.parse('passed')).toThrow();
    });

    it('should validate ConfidenceLevel', () => {
      expect(ConfidenceLevelSchema.parse('weak')).toBe('weak');
      expect(ConfidenceLevelSchema.parse('medium')).toBe('medium');
      expect(ConfidenceLevelSchema.parse('strong')).toBe('strong');
      expect(() => ConfidenceLevelSchema.parse('expert')).toThrow();
    });
  });

  describe('ProblemMetadata Schema', () => {
    const validMetadata: ProblemMetadata = {
      platform: 'leetcode',
      title: 'Two Sum',
      url: 'https://leetcode.com/problems/two-sum/',
      difficulty: 'Easy',
      tags: ['array', 'hash-table'],
      topic: 'arrays',
      description: 'Given an array of integers...',
      language: 'python',
      dateSolved: new Date('2024-01-01'),
      status: 'solved',
    };

    it('should validate valid ProblemMetadata', () => {
      const result = ProblemMetadataSchema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const invalid = { ...validMetadata, title: '' };
      const result = ProblemMetadataSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL', () => {
      const invalid = { ...validMetadata, url: 'not-a-url' };
      const result = ProblemMetadataSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should default topic to uncategorized', () => {
      const withoutTopic = { ...validMetadata };
      delete (withoutTopic as any).topic;
      const result = ProblemMetadataSchema.parse(withoutTopic);
      expect(result.topic).toBe('uncategorized');
    });

    it('should default status to solved', () => {
      const withoutStatus = { ...validMetadata };
      delete (withoutStatus as any).status;
      const result = ProblemMetadataSchema.parse(withoutStatus);
      expect(result.status).toBe('solved');
    });

    it('should reject invalid platform', () => {
      const invalid = { ...validMetadata, platform: 'hackerrank' };
      const result = ProblemMetadataSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Solution Schema', () => {
    const validSolution: Solution = {
      code: 'def two_sum(nums, target): ...',
      language: 'python',
      languageExtension: '.py',
    };

    it('should validate valid Solution', () => {
      const result = SolutionSchema.safeParse(validSolution);
      expect(result.success).toBe(true);
    });

    it('should reject empty code', () => {
      const invalid = { ...validSolution, code: '' };
      const result = SolutionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject extension without dot', () => {
      const invalid = { ...validSolution, languageExtension: 'py' };
      const result = SolutionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should accept various valid extensions', () => {
      const extensions = ['.py', '.js', '.ts', '.cpp', '.java', '.go', '.rs'];
      extensions.forEach((ext) => {
        const solution = { ...validSolution, languageExtension: ext };
        const result = SolutionSchema.safeParse(solution);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('ReviewStats Schema', () => {
    const validStats: ReviewStats = {
      firstSolvedDate: new Date('2024-01-01'),
      lastReviewedDate: null,
      nextReviewDate: new Date('2024-01-02'),
      reviewCount: 0,
      confidenceScore: 'weak',
      mistakeCount: 0,
      easeFactor: 2.5,
      currentInterval: 1.0,
    };

    it('should validate valid ReviewStats', () => {
      const result = ReviewStatsSchema.safeParse(validStats);
      expect(result.success).toBe(true);
    });

    it('should accept null lastReviewedDate', () => {
      const result = ReviewStatsSchema.safeParse(validStats);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lastReviewedDate).toBeNull();
      }
    });

    it('should reject negative reviewCount', () => {
      const invalid = { ...validStats, reviewCount: -1 };
      const result = ReviewStatsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject easeFactor below 1.3', () => {
      const invalid = { ...validStats, easeFactor: 1.0 };
      const result = ReviewStatsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject easeFactor above 3.0', () => {
      const invalid = { ...validStats, easeFactor: 3.5 };
      const result = ReviewStatsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject negative currentInterval', () => {
      const invalid = { ...validStats, currentInterval: -1 };
      const result = ReviewStatsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('ProblemEntry Schema', () => {
    const validEntry: ProblemEntry = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      metadata: {
        platform: 'leetcode',
        title: 'Two Sum',
        url: 'https://leetcode.com/problems/two-sum/',
        difficulty: 'Easy',
        tags: ['array', 'hash-table'],
        topic: 'arrays',
        description: 'Given an array...',
        language: 'python',
        dateSolved: new Date('2024-01-01'),
        status: 'solved',
      },
      solution: {
        code: 'def two_sum(nums, target): ...',
        language: 'python',
        languageExtension: '.py',
      },
      notes: 'Used hash table for O(n) solution',
      filePath: '/problems/leetcode/arrays/two-sum',
      reviewStats: {
        firstSolvedDate: new Date('2024-01-01'),
        lastReviewedDate: null,
        nextReviewDate: new Date('2024-01-02'),
        reviewCount: 0,
        confidenceScore: 'weak',
        mistakeCount: 0,
        easeFactor: 2.5,
        currentInterval: 1.0,
      },
    };

    it('should validate valid ProblemEntry', () => {
      const result = ProblemEntrySchema.safeParse(validEntry);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const invalid = { ...validEntry, id: 'not-a-uuid' };
      const result = ProblemEntrySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject empty filePath', () => {
      const invalid = { ...validEntry, filePath: '' };
      const result = ProblemEntrySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Config Schema', () => {
    const validConfig: Config = {
      git: {
        remoteUrl: 'https://github.com/user/repo.git',
        autoPush: false,
        branch: 'main',
      },
      editor: {
        command: 'vim',
      },
      browser: {
        cdpUrl: 'http://localhost:9222',
        profile: null,
      },
      spacedRepetition: {
        easyMultiplier: 2.5,
        mediumMultiplier: 1.5,
        hardMultiplier: 1.0,
        maxInterval: 180,
      },
      defaults: {
        platform: 'leetcode',
        language: 'python',
      },
    };

    it('should validate valid Config', () => {
      const result = ConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should accept null remoteUrl', () => {
      const withNull = { ...validConfig, git: { ...validConfig.git, remoteUrl: null } };
      const result = ConfigSchema.safeParse(withNull);
      expect(result.success).toBe(true);
    });

    it('should reject invalid remoteUrl', () => {
      const invalid = { ...validConfig, git: { ...validConfig.git, remoteUrl: 'not-a-url' } };
      const result = ConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject empty editor command', () => {
      const invalid = { ...validConfig, editor: { command: '' } };
      const result = ConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject negative multipliers', () => {
      const invalid = {
        ...validConfig,
        spacedRepetition: { ...validConfig.spacedRepetition, easyMultiplier: -1 },
      };
      const result = ConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('ReviewHistory Schema', () => {
    it('should validate valid ReviewHistory', () => {
      const history = {
        reviewCount: 5,
        mistakeCount: 2,
        recentOutcomes: ['easy', 'medium', 'hard', 'easy', 'easy'] as const,
      };
      const result = ReviewHistorySchema.safeParse(history);
      expect(result.success).toBe(true);
    });

    it('should reject negative counts', () => {
      const invalid = {
        reviewCount: -1,
        mistakeCount: 0,
        recentOutcomes: [],
      };
      const result = ReviewHistorySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject invalid outcomes', () => {
      const invalid = {
        reviewCount: 1,
        mistakeCount: 0,
        recentOutcomes: ['passed'], // invalid outcome
      };
      const result = ReviewHistorySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Validation Functions', () => {
    describe('validateProblemMetadata', () => {
      it('should return success for valid metadata', () => {
        const validData = {
          platform: 'leetcode',
          title: 'Two Sum',
          url: 'https://leetcode.com/problems/two-sum/',
          difficulty: 'Easy',
          tags: ['array'],
          topic: 'arrays',
          description: 'Description',
          language: 'python',
          dateSolved: new Date('2024-01-01'),
          status: 'solved',
        };
        const result = validateProblemMetadata(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe('Two Sum');
        }
      });

      it('should return ValidationError for invalid metadata', () => {
        const invalidData = {
          platform: 'invalid',
          title: '',
          url: 'not-a-url',
        };
        const result = validateProblemMetadata(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error._tag).toBe('ValidationError');
          expect(result.error.fieldErrors).toBeDefined();
        }
      });
    });

    describe('validateSolution', () => {
      it('should return success for valid solution', () => {
        const validData = {
          code: 'def foo(): pass',
          language: 'python',
          languageExtension: '.py',
        };
        const result = validateSolution(validData);
        expect(result.success).toBe(true);
      });

      it('should return ValidationError for empty code', () => {
        const invalidData = {
          code: '',
          language: 'python',
          languageExtension: '.py',
        };
        const result = validateSolution(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error._tag).toBe('ValidationError');
        }
      });
    });

    describe('validateNotes', () => {
      it('should accept non-empty notes', () => {
        const result = validateNotes('This is a valid note');
        expect(result.valid).toBe(true);
      });

      it('should reject empty string', () => {
        const result = validateNotes('');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error._tag).toBe('ValidationError');
        }
      });

      it('Property 1: Notes validation rejects whitespace-only input', () => {
        fc.assert(
          fc.property(
            fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')),
            (whitespaceString) => {
              const result = validateNotes(whitespaceString);
              expect(result.valid).toBe(false);
              if (!result.valid) {
                expect(result.error._tag).toBe('ValidationError');
                expect(result.error.message).toContain('whitespace');
              }
            }
          )
        );
      });

      it('should reject whitespace-only string', () => {
        const result = validateNotes('   \t\n   ');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error._tag).toBe('ValidationError');
          expect(result.error.message).toContain('whitespace');
        }
      });

      it('should accept notes with leading/trailing whitespace if content exists', () => {
        const result = validateNotes('  Valid content  ');
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('Error Constructors', () => {
    it('should create ValidationError', () => {
      const error = createValidationError(
        'Validation failed',
        { field: ['error message'] },
        { extra: 'context' }
      );
      expect(error._tag).toBe('ValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.fieldErrors.field).toEqual(['error message']);
      expect(error.context).toEqual({ extra: 'context' });
    });

    it('should create ExtractionError', () => {
      const error = createExtractionError(
        'Extraction failed',
        'leetcode',
        ['title', 'url']
      );
      expect(error._tag).toBe('ExtractionError');
      expect(error.platform).toBe('leetcode');
      expect(error.missingFields).toEqual(['title', 'url']);
    });

    it('should create AuthenticationError', () => {
      const error = createAuthenticationError('Not logged in', 'geeksforgeeks');
      expect(error._tag).toBe('AuthenticationError');
      expect(error.platform).toBe('geeksforgeeks');
    });

    it('should create DatabaseError', () => {
      const cause = new Error('SQL error');
      const error = createDatabaseError('Insert failed', 'insert', cause);
      expect(error._tag).toBe('DatabaseError');
      expect(error.operation).toBe('insert');
      expect(error.cause).toBe(cause);
    });

    it('should create FileSystemError', () => {
      const error = createFileSystemError('Write failed', 'write', '/path/to/file');
      expect(error._tag).toBe('FileSystemError');
      expect(error.operation).toBe('write');
      expect(error.path).toBe('/path/to/file');
    });

    it('should create GitError', () => {
      const error = createGitError('Push failed', 'push');
      expect(error._tag).toBe('GitError');
      expect(error.operation).toBe('push');
    });

    it('should create BrowserError', () => {
      const error = createBrowserError('Connection failed', 'connect');
      expect(error._tag).toBe('BrowserError');
      expect(error.operation).toBe('connect');
    });

    it('should create DuplicateError', () => {
      const error = createDuplicateError(
        'Duplicate found',
        'https://example.com',
        'problem-123'
      );
      expect(error._tag).toBe('DuplicateError');
      expect(error.url).toBe('https://example.com');
      expect(error.existingProblemId).toBe('problem-123');
    });

    it('should create ConfigurationError', () => {
      const error = createConfigurationError('Invalid config', 'git.remoteUrl');
      expect(error._tag).toBe('ConfigurationError');
      expect(error.configKey).toBe('git.remoteUrl');
    });

    it('should create NotFoundError', () => {
      const error = createNotFoundError('Problem not found', 'problem', 'problem-123');
      expect(error._tag).toBe('NotFoundError');
      expect(error.resourceType).toBe('problem');
      expect(error.identifier).toBe('problem-123');
    });
  });

  describe('Type Guards', () => {
    it('should identify ValidationError', () => {
      const error: DSAVaultError = createValidationError('msg', {});
      expect(isValidationError(error)).toBe(true);
      expect(isExtractionError(error)).toBe(false);
    });

    it('should identify ExtractionError', () => {
      const error: DSAVaultError = createExtractionError('msg', 'leetcode', []);
      expect(isExtractionError(error)).toBe(true);
      expect(isAuthenticationError(error)).toBe(false);
    });

    it('should identify AuthenticationError', () => {
      const error: DSAVaultError = createAuthenticationError('msg', 'leetcode');
      expect(isAuthenticationError(error)).toBe(true);
      expect(isDatabaseError(error)).toBe(false);
    });

    it('should identify DatabaseError', () => {
      const error: DSAVaultError = createDatabaseError('msg', 'insert');
      expect(isDatabaseError(error)).toBe(true);
      expect(isFileSystemError(error)).toBe(false);
    });

    it('should identify FileSystemError', () => {
      const error: DSAVaultError = createFileSystemError('msg', 'read', '/path');
      expect(isFileSystemError(error)).toBe(true);
      expect(isGitError(error)).toBe(false);
    });

    it('should identify GitError', () => {
      const error: DSAVaultError = createGitError('msg', 'push');
      expect(isGitError(error)).toBe(true);
      expect(isBrowserError(error)).toBe(false);
    });

    it('should identify BrowserError', () => {
      const error: DSAVaultError = createBrowserError('msg', 'connect');
      expect(isBrowserError(error)).toBe(true);
      expect(isDuplicateError(error)).toBe(false);
    });

    it('should identify DuplicateError', () => {
      const error: DSAVaultError = createDuplicateError('msg', 'url', 'id');
      expect(isDuplicateError(error)).toBe(true);
      expect(isConfigurationError(error)).toBe(false);
    });

    it('should identify ConfigurationError', () => {
      const error: DSAVaultError = createConfigurationError('msg', 'key');
      expect(isConfigurationError(error)).toBe(true);
      expect(isNotFoundError(error)).toBe(false);
    });

    it('should identify NotFoundError', () => {
      const error: DSAVaultError = createNotFoundError('msg', 'problem', 'id');
      expect(isNotFoundError(error)).toBe(true);
      expect(isValidationError(error)).toBe(false);
    });
  });
});
