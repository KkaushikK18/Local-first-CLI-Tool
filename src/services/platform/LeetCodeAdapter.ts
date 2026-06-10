import { type Page } from 'playwright';
import { PlatformAdapter } from './IPlatformAdapter.js';
import {
  type ProblemMetadata,
  type Solution,
  type PlatformName,
  createExtractionError,
  createAuthenticationError,
} from '../../types/index.js';
import { getFileExtension } from '../../utils/index.js';

export class LeetCodeAdapter extends PlatformAdapter {
  readonly platformName: PlatformName = 'leetcode';

  canHandle(url: string): boolean {
    return url.includes('leetcode.com/problems/');
  }

  async isAuthenticated(page: Page): Promise<boolean> {
    try {
      // LeetCode usually shows a profile icon or user menu when logged in
      const hasProfile = await this.waitForAnySelector(page, ['#navbar_user_avatar', '[data-cy="avatar"]'], 2000);
      return hasProfile !== null;
    } catch {
      return false;
    }
  }

  async extractMetadata(page: Page): Promise<ProblemMetadata> {
    const missingFields: string[] = [];
    const url = page.url();

    // 1. Extract Title
    let title = await this.extractTextFromAny(page, [
      '.text-title-large', // new UI
      '[data-cy="question-title"]', // old UI
      'div.flex.items-start > div > a', // fallback
    ]);
    if (title) {
      // Remove problem number prefix (e.g., "1. Two Sum" -> "Two Sum")
      title = title.replace(/^\d+\.\s*/, '');
    } else {
      missingFields.push('title');
      title = 'Unknown LeetCode Problem';
    }

    // 2. Extract Difficulty
    const difficultyText = await this.extractTextFromAny(page, [
      '[data-degree="easy"]', '[data-degree="medium"]', '[data-degree="hard"]',
      '.text-difficulty-easy', '.text-difficulty-medium', '.text-difficulty-hard',
      '[diff="easy"]', '[diff="medium"]', '[diff="hard"]',
    ]);
    
    let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium'; // default
    if (difficultyText) {
      const d = difficultyText.toLowerCase();
      if (d.includes('easy')) difficulty = 'Easy';
      else if (d.includes('hard')) difficulty = 'Hard';
    } else {
      missingFields.push('difficulty');
    }

    // 3. Extract Tags (Topics)
    const tags: string[] = [];
    try {
      // Find the topic tags section and click to expand if necessary
      // This is a simplified approach; in reality, we might need to click the "Related Topics" button
      const tagElements = await page.$$('.topic-tag__1iZ9, a[href^="/tag/"]');
      for (const el of tagElements) {
        const text = await el.textContent();
        if (text) tags.push(text.trim());
      }
    } catch {
      // Non-fatal if we can't get tags
    }

    // Determine primary topic from tags or default
    const firstTag = tags.length > 0 ? tags[0] : undefined;
    const topic = firstTag ? firstTag.toLowerCase().replace(/\s+/g, '-') : 'uncategorized';

    // 4. Extract Description
    let description = await this.extractTextFromAny(page, [
      '[data-track-load="description_content"]', // new UI
      '.content__u3I1', // old UI
    ]);
    if (!description) {
      description = '';
      missingFields.push('description');
    }

    // 5. Extract selected language
    let language = await this.extractTextFromAny(page, [
      '#editor [data-mode-id]', // Monaco editor mode
      '.ant-select-selection-selected-value', // Old language dropdown
      '[data-track-load="editor_language_select"] .whitespace-nowrap', // New UI
    ]);
    
    if (!language) {
      // Fallback: try to guess or use python
      language = 'python';
      missingFields.push('language');
    }

    if (missingFields.length > 0) {
      // We could throw here, but we'll try to proceed with what we have
      // In a strict implementation, we would throw createExtractionError
      console.warn(`LeetCode extraction missing fields: ${missingFields.join(', ')}`);
    }

    return {
      platform: this.platformName,
      title,
      url,
      difficulty,
      tags,
      topic,
      description,
      language: language.toLowerCase(),
      dateSolved: new Date(),
      status: 'solved',
    };
  }

  async extractSolution(page: Page): Promise<Solution> {
    let code = '';
    
    // 1. Try Monaco Editor API
    try {
      // Inject script to get value from monaco editor
      code = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        if (win.monaco && win.monaco.editor) {
          const models = win.monaco.editor.getModels();
          if (models.length > 0) {
            return models[0].getValue();
          }
        }
        return '';
      });
    } catch (e) {
      // Continue to fallback
    }

    // 2. Fallback to copy button or lines
    if (!code) {
      try {
        const lines = await page.$$eval('.view-line', (elements) => 
          elements.map(el => el.textContent).join('\n')
        );
        code = lines || '';
      } catch (e) {
        // Ignore
      }
    }

    // 3. Try to get the language
    let language = await this.extractTextFromAny(page, [
      '[data-track-load="editor_language_select"] .whitespace-nowrap',
      '.ant-select-selection-selected-value',
    ]);
    
    if (!language) {
      language = 'python';
    } else {
      language = language.toLowerCase();
    }

    if (!code || code.trim() === '') {
      throw createExtractionError(
        'Failed to extract solution code from LeetCode editor',
        this.platformName,
        ['code']
      );
    }

    return {
      code,
      language,
      languageExtension: getFileExtension(language),
    };
  }
}
