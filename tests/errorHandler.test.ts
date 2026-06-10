import { describe, it, expect } from 'vitest';
import { ErrorHandler } from '../src/utils/errorHandler.js';
import { 
  createValidationError, 
  createExtractionError, 
  createDuplicateError, 
  createDatabaseError 
} from '../src/types/index.js';

describe('ErrorHandler', () => {
  it('formats ValidationError correctly', () => {
    const err = createValidationError('Invalid data', {
      title: ['Cannot be empty'],
      url: ['Must be a valid URL']
    });

    const output = ErrorHandler.formatError(err);
    
    expect(output).toContain('[ValidationError]');
    expect(output).toContain('Invalid data');
    expect(output).toContain('title: Cannot be empty');
    expect(output).toContain('url: Must be a valid URL');
    expect(output).toContain('Recovery:');
  });

  it('formats ExtractionError correctly', () => {
    const err = createExtractionError('Failed to parse', 'leetcode', ['title', 'difficulty']);

    const output = ErrorHandler.formatError(err);
    
    expect(output).toContain('[ExtractionError]');
    expect(output).toContain('leetcode');
    expect(output).toContain('title, difficulty');
    expect(output).toContain('Recovery:');
  });

  it('formats standard Error with stack trace', () => {
    const err = new Error('Standard JS error');
    const output = ErrorHandler.formatError(err);
    
    expect(output).toContain('[Error] Standard JS error');
  });

  it('formats DatabaseError correctly with cause', () => {
    const cause = new Error('SQLITE_BUSY');
    const err = createDatabaseError('Failed to insert', 'insert', cause);

    const output = ErrorHandler.formatError(err);
    
    expect(output).toContain('[DatabaseError]');
    expect(output).toContain('Failed to insert');
    expect(output).toContain('Operation: insert');
    expect(output).toContain('Cause: SQLITE_BUSY');
  });
});
