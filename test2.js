import { chromium } from 'playwright';

async function test() {
  console.log('Connecting to Chrome...');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  console.log('Connected!');
  
  await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2s

  const contexts = browser.contexts();
  console.log(`Found ${contexts.length} contexts.`);
  
  for (let i = 0; i < contexts.length; i++) {
    const pages = contexts[i].pages();
    console.log(`Context ${i} has ${pages.length} pages.`);
    for (const p of pages) {
      try {
        console.log(` - ${p.url()}`);
      } catch (e) {
        console.log(` - Error getting URL: ${e.message}`);
      }
    }
  }
  
  await browser.close();
}

test().catch(console.error);
