import { type Page } from 'playwright';
import { type ProblemMetadata, type Solution, type PlatformName } from '../../types/index.js';

export interface IPlatformAdapter {
  /**
   * The canonical name of the platform
   */
  readonly platformName: PlatformName;

  /**
   * Checks if this adapter can handle the given URL
   */
  canHandle(url: string): boolean;

  /**
   * Checks if the user is authenticated on the platform
   */
  isAuthenticated(page: Page): Promise<boolean>;

  /**
   * Extracts problem metadata from the current page
   */
  extractMetadata(page: Page): Promise<ProblemMetadata>;

  /**
   * Extracts the user's solution from the current page
   */
  extractSolution(page: Page): Promise<Solution>;
}

export abstract class PlatformAdapter implements IPlatformAdapter {
  abstract readonly platformName: PlatformName;

  abstract canHandle(url: string): boolean;

  abstract isAuthenticated(page: Page): Promise<boolean>;

  abstract extractMetadata(page: Page): Promise<ProblemMetadata>;

  abstract extractSolution(page: Page): Promise<Solution>;

  /**
   * Utility to wait for any of the given selectors to be visible
   */
  protected async waitForAnySelector(page: Page, selectors: string[], timeout = 5000): Promise<string | null> {
    const promises = selectors.map(async (selector) => {
      try {
        await page.waitForSelector(selector, { state: 'visible', timeout });
        return selector;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.find(Boolean) || null;
  }

  /**
   * Safely extract text from a selector
   */
  protected async extractText(page: Page, selector: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (!element) return null;
      const text = await element.textContent();
      return text ? text.trim() : null;
    } catch {
      return null;
    }
  }

  /**
   * Try multiple selectors to extract text, returning the first match
   */
  protected async extractTextFromAny(page: Page, selectors: string[]): Promise<string | null> {
    for (const selector of selectors) {
      const text = await this.extractText(page, selector);
      if (text) return text;
    }
    return null;
  }
}
