import { type IPlatformAdapter } from './IPlatformAdapter.js';
import { LeetCodeAdapter } from './LeetCodeAdapter.js';
import { GeeksForGeeksAdapter } from './GeeksForGeeksAdapter.js';
import { createExtractionError } from '../../types/index.js';

export class PlatformFactory {
  private static adapters: IPlatformAdapter[] = [
    new LeetCodeAdapter(),
    new GeeksForGeeksAdapter(),
  ];

  /**
   * Registers a new platform adapter
   */
  static registerAdapter(adapter: IPlatformAdapter): void {
    this.adapters.push(adapter);
  }

  /**
   * Detects and returns the appropriate platform adapter for the given URL
   * @throws ExtractionError if no adapter can handle the URL
   */
  static getAdapterForUrl(url: string): IPlatformAdapter {
    const adapter = this.adapters.find(a => a.canHandle(url));
    
    if (!adapter) {
      throw createExtractionError(
        `No platform adapter found for URL: ${url}`,
        'leetcode', // default or unknown
        [],
        undefined
      );
    }
    
    return adapter;
  }

  /**
   * Returns all registered adapters
   */
  static getRegisteredAdapters(): IPlatformAdapter[] {
    return [...this.adapters];
  }
}
