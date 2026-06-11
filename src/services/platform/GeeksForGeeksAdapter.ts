import { type Page } from 'playwright';
import { PlatformAdapter } from './IPlatformAdapter.js';
import {
  type ProblemMetadata,
  type Solution,
  type PlatformName,
  createExtractionError,
} from '../../types/index.js';
import { getFileExtension } from '../../utils/index.js';

export class GeeksForGeeksAdapter extends PlatformAdapter {
  readonly platformName: PlatformName = 'geeksforgeeks';

  canHandle(url: string): boolean {
    return url.includes('geeksforgeeks.org/problems/') || url.includes('practice.geeksforgeeks.org/problems/');
  }

  async isAuthenticated(page: Page): Promise<boolean> {
    try {
      // Check for user profile image or logout button
      const hasProfile = await this.waitForAnySelector(page, [
        '.profile-pic',
        '.header-profile-img',
        '[data-cy="profile-image"]'
      ], 2000);
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
      'h3', // New GFG UI puts title in the first h3
      '.problems_problem_content__title > h3',
      '.problem-tab__name',
      'h3.bqpRbd', // newer UI class
    ]);
    if (!title) {
      missingFields.push('title');
      title = 'Unknown GFG Problem';
    }

    // 2. Extract Difficulty
    let difficultyText = await this.extractTextFromAny(page, [
      '.problems_problem_content__difficulty > span',
      '.problem-tab__difficulty',
      'span.S_Zk0', // newer UI class for difficulty
    ]);
    
    // If specific selectors fail, search all spans for difficulty keywords
    if (!difficultyText) {
      difficultyText = await page.evaluate(() => {
        const spans = document.querySelectorAll('span, p, div, strong');
        for (const s of Array.from(spans)) {
          const txt = (s.textContent || '').trim().toLowerCase();
          if (txt === 'easy' || txt === 'medium' || txt === 'hard' || txt === 'basic') {
            return txt;
          }
        }
        return null;
      });
    }
    
    let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium'; // default
    if (difficultyText) {
      const d = difficultyText.toLowerCase();
      if (d.includes('easy') || d.includes('basic') || d.includes('school')) difficulty = 'Easy';
      else if (d.includes('hard')) difficulty = 'Hard';
    } else {
      missingFields.push('difficulty');
    }

    // 3. Extract Tags (Topics)
    const tags: string[] = [];
    try {
      // Try to find topic tags
      const tagElements = await page.$$('.topic-tags > a, .problems_topic_tags__links > a');
      for (const el of tagElements) {
        const text = await el.textContent();
        if (text) tags.push(text.trim());
      }
    } catch {
      // Non-fatal
    }

    // Determine primary topic from tags or default
    const firstTag = tags.length > 0 ? tags[0] : undefined;
    const topic = firstTag ? firstTag.toLowerCase().replace(/\s+/g, '-') : 'uncategorized';

    // 4. Extract Description
    let description = await this.extractTextFromAny(page, [
      '.problems_problem_content__Xm_eO', // New GFG hashed class
      'div[class*="problem_content"]', // Fallback for hashes
      '.problems_problem_content__description',
      '.problem-statement',
    ]);
    if (!description) {
      description = '';
      missingFields.push('description');
    }

    // 5. Extract selected language
    let language = await this.extractTextFromAny(page, [
      '.lang-select .selected',
      '.ui.dropdown.language-dropdown .text',
      '.divider.text', // semantic UI dropdown
    ]);
    
    if (!language) {
      language = 'python';
      missingFields.push('language');
    }

    if (missingFields.length > 0) {
      console.warn(`GFG extraction missing fields: ${missingFields.join(', ')}`);
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
    
    // 1. Try CodeMirror / Monaco Editor API or injecting script
    try {
      code = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        // Try monaco first if they use it
        if (win.monaco && win.monaco.editor) {
          const models = win.monaco.editor.getModels();
          if (models.length > 0) {
            return models[0].getValue();
          }
        }
        
        // Try to get from react props or hidden textarea
        const hiddenTextarea = document.querySelector('.CodeMirror textarea, #code') as HTMLTextAreaElement;
        if (hiddenTextarea) {
          return hiddenTextarea.value;
        }
        
        // Try Ace Editor
        if (win.ace) {
          const editorElement = document.querySelector('.ace_editor');
          if (editorElement) {
             return win.ace.edit(editorElement).getValue();
          }
        }

        return '';
      });
    } catch (e) {
      // Continue to fallback
    }

    // 2. Fallback to copy line by line
    if (!code) {
      try {
        const lines = await page.$$eval('.CodeMirror-line', (elements) => 
          elements.map(el => el.textContent).join('\n')
        );
        code = lines || '';
      } catch (e) {
        // Ignore
      }
    }

    // 3. Extract the language
    let language = await this.extractTextFromAny(page, [
      '.lang-select .selected',
      '.ui.dropdown.language-dropdown .text',
      '.divider.text',
    ]);
    
    if (!language) {
      language = 'python';
    } else {
      language = language.toLowerCase();
    }

    if (!code || code.trim() === '') {
      throw createExtractionError(
        'Failed to extract solution code from GeeksForGeeks editor',
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
