import { chromium } from 'playwright';

async function debugGFG() {
  console.log('Connecting to browser...');
  let wsUrl = '';
  try {
    const res = await fetch('http://localhost:9222/json');
    const targets = await res.json();
    for (const t of targets) {
      if (t.type === 'page' && t.url && t.url.includes('geeksforgeeks.org/problems/')) {
        wsUrl = t.webSocketDebuggerUrl;
        break;
      }
    }
  } catch (e) {
    console.error('Failed to get targets:', e);
    return;
  }

  if (!wsUrl) {
    console.log('No GFG tab found.');
    return;
  }

  const browser = await chromium.connectOverCDP(wsUrl);
  
  // Wait for context and page
  await new Promise(r => setTimeout(r, 2000));
  
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  if (!page) {
    console.log('Page not found in context after 2s');
    await browser.close();
    return;
  }

  const info = await page.evaluate(() => {
    // Collect all h2/h3 tags
    const headers = Array.from(document.querySelectorAll('h2, h3, div')).map(el => {
      return { tag: el.tagName, className: el.className, text: (el.textContent || '').substring(0, 50).replace(/\s+/g, ' ').trim() };
    });
    
    // Find Monaco editor or codemirror
    const hasMonaco = !!window.monaco;
    const editorClasses = Array.from(document.querySelectorAll('[class*="editor"], [class*="code"], [class*="Code"]')).map(el => el.className);
    
    // Find typical difficulty elements
    const spans = Array.from(document.querySelectorAll('span, div')).filter(el => {
      const text = (el.textContent || '').toLowerCase();
      return text === 'easy' || text === 'medium' || text === 'hard' || text === 'basic';
    }).map(el => el.className);

    // Language dropdown
    const dropdowns = Array.from(document.querySelectorAll('button, div, span')).filter(el => {
      const text = (el.textContent || '').toLowerCase();
      return text.includes('cpp') || text.includes('java') || text.includes('python');
    }).map(el => el.className);

    return {
      headers: headers.filter(h => h.text.includes('Zero Sum') || h.text.includes('Subarray')),
      hasMonaco,
      editorClasses: [...new Set(editorClasses)].slice(0, 10),
      difficultyClasses: [...new Set(spans)],
      languageClasses: [...new Set(dropdowns)].slice(0, 10)
    };
  });

  console.log('--- GFG DOM Dump ---');
  console.dir(info, { depth: null });

  await browser.close();
}

debugGFG().catch(console.error);
