import { chromium, type Browser, type Page } from 'playwright';
import { createBrowserError } from '../types/index.js';

export interface BrowserConfig {
  cdpUrl?: string;
}

export class BrowserService {
  private browser: Browser | null = null;
  private cdpUrl: string;

  constructor(config: BrowserConfig = {}) {
    this.cdpUrl = config.cdpUrl || 'http://localhost:9222';
  }

  /**
   * Connects to an existing browser instance via Chrome DevTools Protocol (CDP)
   */
  async connect(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    try {
      this.browser = await chromium.connectOverCDP(this.cdpUrl);
      
      // Handle disconnected event
      this.browser.on('disconnected', () => {
        this.browser = null;
      });
      
      return this.browser;
    } catch (error) {
      throw createBrowserError(
        `Failed to connect to browser at ${this.cdpUrl}. Ensure Chrome is running with --remote-debugging-port=9222`,
        'connect',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Disconnects from the browser
   */
  async disconnect(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Enumerate all browser pages/tabs
   */
  async getPages(): Promise<Page[]> {
    if (!this.browser) return [];
    
    let contexts = this.browser.contexts();
    let allPages: Page[] = [];
    
    for (const context of contexts) {
      allPages.push(...context.pages());
    }
    
    return allPages;
  }

  /**
   * Filter tabs by supported platform URLs
   */
  async getPlatformPages(): Promise<Page[]> {
    // We will query the Chrome JSON endpoint directly to bypass Playwright's context discovery issues
    for (let attempts = 0; attempts < 5; attempts++) {
      try {
        console.log(`\n[DEBUG] Fetching targets from ${this.cdpUrl}/json...`);
        // Node 18+ has global fetch
        const response = await fetch(`${this.cdpUrl}/json`);
        const targets = await response.json();
        
        for (const target of targets) {
          if (target.type === 'page' && target.url) {
            console.log(`[DEBUG] Found target URL: ${target.url}`);
            if (target.url.includes('leetcode.com/problems/') || 
                target.url.includes('geeksforgeeks.org/problems/') ||
                target.url.includes('practice.geeksforgeeks.org/problems/')) {
              
              // We found the platform page! Now we need to make sure Playwright has it.
              // Instead of relying on contexts(), let's just get the pages from the browser
              const contexts = this.browser!.contexts();
              for (const context of contexts) {
                for (const page of context.pages()) {
                  if (page.url() === target.url || page.url() === 'about:blank') {
                      // Note: sometimes Playwright page URL isn't fully updated immediately
                      // But if we know it's there from CDP, we can try to force navigate or use it.
                  }
                }
              }
              
              // Better yet, just return the filtered contexts from Playwright if it finally found them
              const playwrightPages = await this.getPages();
              const matched = playwrightPages.filter(p => {
                 try {
                     const url = p.url();
                     return url.includes('leetcode.com/problems/') || 
                            url.includes('geeksforgeeks.org/problems/') ||
                            url.includes('practice.geeksforgeeks.org/problems/');
                 } catch { return false; }
              });
              
              if (matched.length > 0) return matched;
              
              // If Playwright STILL doesn't see it, we can create a new context and attach to the WS url?
              // Playwright doesn't easily let us convert a target to a Page without browser.contexts().
            }
          }
        }
        
        // If we reach here, Playwright hasn't exposed it yet, or it's not in the JSON.
        // Let's just do standard Playwright fallback.
        const pages = await this.getPages();
        const matchedFallback = pages.filter(page => {
          try {
            const url = page.url();
            return url.includes('leetcode.com/problems/') || 
                   url.includes('geeksforgeeks.org/problems/') ||
                   url.includes('practice.geeksforgeeks.org/problems/');
          } catch {
            return false;
          }
        });
        if (matchedFallback.length > 0) return matchedFallback;
        
      } catch (err) {
         console.log(`[DEBUG] Error in target fetch: ${err}`);
      }
      
      // Wait 500ms before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return [];
  }

  /**
   * Gets the connection instructions for different operating systems
   */
  static getConnectionInstructions(): string {
    return `
To use DSA Vault capture, you need to start Chrome/Edge with remote debugging enabled.

macOS:
/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222

Windows:
"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222

Linux:
google-chrome --remote-debugging-port=9222
    `.trim();
  }
}
