import { describe, it, expect } from 'vitest';
import { PlatformFactory } from '../src/services/platform/PlatformFactory.js';
import { LeetCodeAdapter } from '../src/services/platform/LeetCodeAdapter.js';
import { GeeksForGeeksAdapter } from '../src/services/platform/GeeksForGeeksAdapter.js';

describe('PlatformFactory', () => {
  it('should return LeetCodeAdapter for leetcode URLs', () => {
    const adapter = PlatformFactory.getAdapterForUrl('https://leetcode.com/problems/two-sum/');
    expect(adapter).toBeInstanceOf(LeetCodeAdapter);
    expect(adapter.platformName).toBe('leetcode');
  });

  it('should return GeeksForGeeksAdapter for geeksforgeeks URLs', () => {
    const adapter = PlatformFactory.getAdapterForUrl('https://www.geeksforgeeks.org/problems/missing-number-in-array1416/1');
    expect(adapter).toBeInstanceOf(GeeksForGeeksAdapter);
    expect(adapter.platformName).toBe('geeksforgeeks');
  });

  it('should return GeeksForGeeksAdapter for practice.geeksforgeeks.org URLs', () => {
    const adapter = PlatformFactory.getAdapterForUrl('https://practice.geeksforgeeks.org/problems/missing-number-in-array1416/1');
    expect(adapter).toBeInstanceOf(GeeksForGeeksAdapter);
  });

  it('should throw ExtractionError for unsupported URLs', () => {
    expect(() => {
      PlatformFactory.getAdapterForUrl('https://hackerrank.com/challenges/solve-me-first/problem');
    }).toThrow('No platform adapter found for URL');
  });
});
