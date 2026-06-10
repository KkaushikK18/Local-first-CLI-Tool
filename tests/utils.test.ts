import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sanitizeProblemName, getFileExtension } from '../src/utils';

describe('Utility Functions', () => {
  describe('sanitizeProblemName', () => {
    it('Property 5: Problem name sanitization produces filesystem-safe strings', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (title) => {
            const sanitized = sanitizeProblemName(title);
            
            // Should not be empty unless input was empty or only special chars
            // If empty, it's safe (though in practice we might default to 'untitled')
            if (sanitized === '') return true;

            // Must only contain a-z, 0-9, and hyphens
            const isSafe = /^[a-z0-9-]+$/.test(sanitized);
            
            // Must not have consecutive hyphens
            const noConsecutiveHyphens = !/--/.test(sanitized);
            
            // Must not start or end with a hyphen
            const noEdgeHyphens = !/^-|-$/.test(sanitized);

            return isSafe && noConsecutiveHyphens && noEdgeHyphens;
          }
        )
      );
    });

    it('handles specific examples correctly', () => {
      expect(sanitizeProblemName('Two Sum')).toBe('two-sum');
      expect(sanitizeProblemName('Best Time to Buy and Sell Stock II')).toBe('best-time-to-buy-and-sell-stock-ii');
      expect(sanitizeProblemName('  Whitespace   and special chars!@#  ')).toBe('whitespace-and-special-chars');
      expect(sanitizeProblemName('Café au Lait')).toBe('cafe-au-lait');
    });
  });

  describe('getFileExtension', () => {
    it('Property 4: File extension language mapping is correct', () => {
      const knownLanguages = [
        { lang: 'python', ext: '.py' },
        { lang: 'Python', ext: '.py' },
        { lang: ' javascript ', ext: '.js' },
        { lang: 'TypeScript', ext: '.ts' },
        { lang: 'Java', ext: '.java' },
        { lang: 'C++', ext: '.cpp' },
      ];

      for (const { lang, ext } of knownLanguages) {
        expect(getFileExtension(lang)).toBe(ext);
      }
    });

    it('returns .txt for unknown languages', () => {
      expect(getFileExtension('unknown-lang')).toBe('.txt');
      expect(getFileExtension('')).toBe('.txt');
    });
  });
});
