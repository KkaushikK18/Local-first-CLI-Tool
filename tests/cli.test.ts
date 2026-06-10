import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { initCommand } from '../src/cli/commands/init.js';
import { randomUUID } from 'crypto';

// Note: Testing CLI commands that use process.exit and process.cwd can be tricky.
// We'll mock process.cwd and process.exit
describe('init command', () => {
  let tempDir: string;
  let originalCwd: () => string;
  let exitMock: any;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), `test-workspace-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });

    originalCwd = process.cwd;
    process.cwd = () => tempDir;

    exitMock = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`Process exited with code ${code}`);
    });
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    exitMock.mockRestore();
    
    // Cleanup temp dir
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('initializes a new workspace successfully', async () => {
    await initCommand.parseAsync(['node', 'test', 'init']);

    // Check directories
    expect(existsSync(path.join(tempDir, 'problems'))).toBe(true);
    expect(existsSync(path.join(tempDir, 'reviews'))).toBe(true);
    expect(existsSync(path.join(tempDir, 'templates'))).toBe(true);
    expect(existsSync(path.join(tempDir, 'logs'))).toBe(true);

    // Check database
    expect(existsSync(path.join(tempDir, 'reviews', 'dsa-vault.db'))).toBe(true);

    // Check git
    expect(existsSync(path.join(tempDir, '.git'))).toBe(true);

    // Check config
    expect(existsSync(path.join(tempDir, 'config.json'))).toBe(true);

    // Check template
    expect(existsSync(path.join(tempDir, 'templates', 'notes-template.md'))).toBe(true);
  });

  it('exits if workspace is already initialized', async () => {
    // Manually create config.json to simulate initialized workspace
    await fs.writeFile(path.join(tempDir, 'config.json'), '{}', 'utf-8');

    // Should resolve successfully without doing anything else
    await expect(initCommand.parseAsync(['node', 'test', 'init'])).resolves.not.toThrow();
  });
});
