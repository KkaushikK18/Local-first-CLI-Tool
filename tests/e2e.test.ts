import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { program } from '../src/cli/index.js';
import { randomUUID } from 'crypto';

// This test suite runs actual CLI commands against a temporary workspace
describe('E2E Full Pipeline', () => {
  let tempDir: string;
  let originalCwd: () => string;
  let exitMock: any;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), `e2e-workspace-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });

    originalCwd = process.cwd;
    process.cwd = () => tempDir;

    exitMock = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`Process exited with code ${code}`);
    });
    
    // Mock console.log to avoid noisy output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    vi.restoreAllMocks();
    
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('runs the complete vault lifecycle', async () => {
    // 1. Init
    await program.parseAsync(['node', 'test', 'init']);
    expect(existsSync(path.join(tempDir, 'reviews', 'dsa-vault.db'))).toBe(true);

    // 2. Config Set
    await program.parseAsync(['node', 'test', 'config', 'set', 'git.autoPush', 'false']);
    
    // 3. Import (mock CaptureEngine inside import.ts or just rely on failure handling)
    // Since we don't have a real browser, import will fail to connect or extract, 
    // but the command should still run and handle the error gracefully without throwing.
    const urlFile = path.join(tempDir, 'urls.txt');
    await fs.writeFile(urlFile, 'https://leetcode.com/problems/two-sum/\n', 'utf-8');
    await program.parseAsync(['node', 'test', 'import', 'urls.txt']);
    
    // 4. Doctor
    // Doctor should check DB, config, etc. It won't fail the process, just prints diagnostics.
    await program.parseAsync(['node', 'test', 'doctor']);
    
    // 5. Stats
    await program.parseAsync(['node', 'test', 'stats']);
    
    // 6. Sync
    await program.parseAsync(['node', 'test', 'sync', '-m', 'Test sync']);
    
    // The main verification is that no command throws an unhandled exception
    // and the system exits cleanly.
    expect(true).toBe(true);
  });
});
