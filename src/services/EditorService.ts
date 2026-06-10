import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import { createFileSystemError } from '../types/index.js';

export class EditorService {
  /**
   * 7.4 Implement interactive note collection
   * Launches the user's editor and waits for it to close, then reads the file.
   */
  static async openEditorAndWait(filePath: string, editorCommand?: string): Promise<string> {
    // Determine editor: config -> EDITOR env var -> VISUAL env var -> fallback (vim)
    const command = editorCommand || process.env.EDITOR || process.env.VISUAL || 'vim';
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    // For VS Code, we need --wait flag to block until closed
    if (cmd === 'code' && !args.includes('--wait')) {
      args.push('--wait');
    }

    args.push(filePath);

    return new Promise((resolve, reject) => {
      const child = spawn(cmd as string, args, {
        stdio: 'inherit', // Let the editor use the current terminal
        shell: true,      // Required on Windows for finding executables sometimes
      });

      (child as import('child_process').ChildProcess).on('error', (err: Error) => {
        reject(
          createFileSystemError(
            `Failed to start editor: ${command}`,
            'read',
            filePath,
            err
          )
        );
      });

      (child as import('child_process').ChildProcess).on('exit', async (code: number | null) => {
        if (code !== 0 && code !== null) {
          // Some editors exit with non-zero if user cancels, but we can just check if file exists
          console.warn(`Editor exited with code ${code}`);
        }

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          resolve(content);
        } catch (error) {
          reject(
            createFileSystemError(
              'Failed to read notes file after editor closed',
              'read',
              filePath,
              error instanceof Error ? error : undefined
            )
          );
        }
      });
    });
  }
}
