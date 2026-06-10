import { BrowserService } from './dist/services/BrowserService.js';

async function run() {
  console.log('Testing BrowserService directly...');
  const service = new BrowserService({ cdpUrl: 'http://localhost:9222' });
  const browser = await service.connect();
  console.log('Connected to browser.');
  
  const pages = await service.getPages();
  console.log(`Initial getPages() returned ${pages.length} pages.`);
  for (const p of pages) {
    console.log(` - ${p.url()}`);
  }
  
  const platformPages = await service.getPlatformPages();
  console.log(`\ngetPlatformPages() returned ${platformPages.length} pages.`);
  for (const p of platformPages) {
    console.log(` - ${p.url()}`);
  }
  
  await service.disconnect();
}

run().catch(console.error);
