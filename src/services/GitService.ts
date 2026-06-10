import simpleGit, { type SimpleGit } from 'simple-git';
import { createFileSystemError } from '../types/index.js';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';

export interface GitConfig {
  workspaceRoot: string;
  autoPush?: boolean;
}

export class GitService {
  private git: SimpleGit;
  private workspaceRoot: string;
  private autoPush: boolean;

  constructor(config: GitConfig) {
    this.workspaceRoot = config.workspaceRoot;
    this.autoPush = config.autoPush ?? false;
    this.git = simpleGit(this.workspaceRoot);
  }

  /**
   * Initializes git repository if not exists
   */
  async init(): Promise<void> {
    try {
      if (!existsSync(path.join(this.workspaceRoot, '.git'))) {
        await this.git.init();
      }
    } catch (error) {
      throw createFileSystemError(
        'Failed to initialize git repository',
        'create',
        this.workspaceRoot,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 7.6 Implement stage, commit, push operations
   */
  async commitProblem(platform: string, title: string, filesToStage: string[]): Promise<string> {
    try {
      // Stage files
      for (const file of filesToStage) {
        await this.git.add(file);
      }

      // Commit
      const commitMessage = `Add ${platform} problem: ${title}`;
      const result = await this.git.commit(commitMessage);
      
      // Push if autoPush is enabled
      if (this.autoPush) {
        await this.push();
      }

      return result.commit;
    } catch (error) {
      throw createFileSystemError(
        `Failed to commit problem: ${title}`,
        'write',
        this.workspaceRoot,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Sync operations: pull
   */
  async pull(): Promise<void> {
    try {
      const remotes = await this.git.getRemotes();
      if (remotes.length === 0) {
        return; // No remote to pull from
      }
      
      await this.git.pull();
    } catch (error) {
      throw createFileSystemError(
        'Failed to pull from remote repository',
        'read',
        this.workspaceRoot,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Sync operations: push
   */
  async push(): Promise<void> {
    try {
      const remotes = await this.git.getRemotes();
      if (remotes.length === 0) {
        console.info('No remote configured. Skipping push.');
        return;
      }
      
      await this.git.push();
    } catch (error) {
      throw createFileSystemError(
        'Failed to push to remote repository',
        'write',
        this.workspaceRoot,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Sync operations: add all, commit with timestamp, pull, and push
   */
  async sync(message?: string): Promise<string | null> {
    try {
      // Add all changes
      await this.git.add('.');

      const status = await this.git.status();
      if (status.staged.length === 0) {
        return null; // Nothing to commit
      }

      const defaultMsg = `DSA Vault Sync: ${new Date().toISOString().split('T')[0]}`;
      const result = await this.git.commit(message || defaultMsg);

      // Attempt to pull first to avoid conflicts if there's a remote
      const remotes = await this.git.getRemotes();
      if (remotes.length > 0) {
        try {
          await this.git.pull({ '--rebase': 'true' });
        } catch (e) {
          console.warn('Pull with rebase failed. You may need to resolve conflicts manually.');
        }
        await this.push();
      }

      return result.commit;
    } catch (error) {
      throw createFileSystemError(
        'Failed to sync repository',
        'write',
        this.workspaceRoot,
        error instanceof Error ? error : undefined
      );
    }
  }
}
