/**
 * Unit tests for ConfigService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigService, DEFAULT_CONFIG } from '../src/services/ConfigService.js';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Config } from '../src/types/index.js';

describe('ConfigService', () => {
  let tempDir: string;
  let configService: ConfigService;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = join(tmpdir(), `dsa-vault-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    configService = new ConfigService(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('should return default config when file does not exist', async () => {
      const config = await configService.load();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should load valid config from file', async () => {
      const customConfig: Config = {
        ...DEFAULT_CONFIG,
        git: {
          remoteUrl: 'https://github.com/user/repo.git',
          autoPush: true,
          branch: 'main'
        }
      };

      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify(customConfig, null, 2),
        'utf-8'
      );

      const loaded = await configService.load();
      expect(loaded).toEqual(customConfig);
    });

    it('should throw error for invalid JSON', async () => {
      await writeFile(
        join(tempDir, 'config.json'),
        'invalid json content',
        'utf-8'
      );

      await expect(configService.load()).rejects.toThrow('Invalid JSON in config file');
    });

    it('should throw error for config missing required fields', async () => {
      const invalidConfig = {
        git: {
          remoteUrl: null
          // missing autoPush and branch
        }
      };

      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify(invalidConfig, null, 2),
        'utf-8'
      );

      await expect(configService.load()).rejects.toThrow('Configuration validation failed');
    });

    it('should throw error for invalid git.remoteUrl format', async () => {
      const invalidConfig: Config = {
        ...DEFAULT_CONFIG,
        git: {
          remoteUrl: 'not-a-valid-url',
          autoPush: false,
          branch: 'main'
        }
      };

      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify(invalidConfig, null, 2),
        'utf-8'
      );

      await expect(configService.load()).rejects.toThrow('Configuration validation failed');
    });

    it('should throw error for invalid spacedRepetition multipliers', async () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        spacedRepetition: {
          easyMultiplier: 15.0, // exceeds max of 10
          mediumMultiplier: 1.5,
          hardMultiplier: 1.0,
          maxInterval: 180
        }
      };

      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify(invalidConfig, null, 2),
        'utf-8'
      );

      await expect(configService.load()).rejects.toThrow('Configuration validation failed');
    });
  });

  describe('save', () => {
    it('should save valid config to file', async () => {
      const customConfig: Config = {
        ...DEFAULT_CONFIG,
        editor: {
          command: 'code --wait'
        }
      };

      await configService.save(customConfig);

      // Load and verify
      const loaded = await configService.load();
      expect(loaded).toEqual(customConfig);
    });

    it('should validate config before saving', async () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        spacedRepetition: {
          easyMultiplier: 2.5,
          mediumMultiplier: 1.5,
          hardMultiplier: 1.0,
          maxInterval: 500 // exceeds max of 365
        }
      } as Config;

      await expect(configService.save(invalidConfig)).rejects.toThrow('Configuration validation failed');
    });

    it('should format JSON with 2-space indentation', async () => {
      await configService.save(DEFAULT_CONFIG);

      const fileContent = await import('fs/promises').then(fs => 
        fs.readFile(join(tempDir, 'config.json'), 'utf-8')
      );

      // Check indentation
      expect(fileContent).toContain('  "git"');
      expect(fileContent).toContain('    "remoteUrl"');
    });
  });

  describe('get', () => {
    it('should load config on first call', async () => {
      const config = await configService.get();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should return cached config on subsequent calls', async () => {
      const first = await configService.get();
      const second = await configService.get();
      expect(first).toBe(second); // same reference
    });
  });

  describe('set', () => {
    it('should update top-level property', async () => {
      await configService.set('editor.command', 'nano');
      const config = await configService.get();
      expect(config.editor.command).toBe('nano');
    });

    it('should update nested property', async () => {
      await configService.set('git.remoteUrl', 'https://github.com/user/repo.git');
      const config = await configService.get();
      expect(config.git.remoteUrl).toBe('https://github.com/user/repo.git');
    });

    it('should update deeply nested property', async () => {
      await configService.set('spacedRepetition.easyMultiplier', 3.0);
      const config = await configService.get();
      expect(config.spacedRepetition.easyMultiplier).toBe(3.0);
    });

    it('should throw error for invalid key path', async () => {
      await expect(configService.set('invalid.key.path', 'value')).rejects.toThrow('Invalid configuration key path');
    });

    it('should validate after setting value', async () => {
      await expect(configService.set('spacedRepetition.maxInterval', 500)).rejects.toThrow('Configuration validation failed');
    });

    it('should persist changes to file', async () => {
      await configService.set('git.autoPush', true);
      
      // Create new service instance to load from file
      const newService = new ConfigService(tempDir);
      const config = await newService.load();
      
      expect(config.git.autoPush).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset config to defaults', async () => {
      // Modify config
      await configService.set('git.autoPush', true);
      await configService.set('editor.command', 'nano');
      
      // Reset
      await configService.reset();
      
      const config = await configService.get();
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('validate', () => {
    it('should return valid for valid config', () => {
      const result = ConfigService.validate(DEFAULT_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid for config with missing fields', () => {
      const invalidConfig = {
        git: {
          remoteUrl: null
        }
      };

      const result = ConfigService.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should return invalid for config with wrong types', () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        git: {
          remoteUrl: null,
          autoPush: 'yes', // should be boolean
          branch: 'main'
        }
      };

      const result = ConfigService.validate(invalidConfig);
      expect(result.valid).toBe(false);
    });

    it('should provide descriptive error messages', () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        spacedRepetition: {
          easyMultiplier: 0.5, // below minimum of 1.0
          mediumMultiplier: 1.5,
          hardMultiplier: 1.0,
          maxInterval: 180
        }
      };

      const result = ConfigService.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain('spacedRepetition.easyMultiplier');
    });
  });

  describe('exists', () => {
    it('should return false when config file does not exist', async () => {
      const exists = await configService.exists();
      expect(exists).toBe(false);
    });

    it('should return true when config file exists', async () => {
      await configService.save(DEFAULT_CONFIG);
      const exists = await configService.exists();
      expect(exists).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should create config file with defaults if it does not exist', async () => {
      await configService.initialize();
      
      const exists = await configService.exists();
      expect(exists).toBe(true);
      
      const config = await configService.load();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should not overwrite existing config file', async () => {
      const customConfig: Config = {
        ...DEFAULT_CONFIG,
        git: {
          remoteUrl: 'https://github.com/user/repo.git',
          autoPush: true,
          branch: 'main'
        }
      };

      await configService.save(customConfig);
      await configService.initialize();
      
      const config = await configService.load();
      expect(config).toEqual(customConfig);
    });
  });

  describe('default configuration values', () => {
    it('should use environment EDITOR variable if available', () => {
      const originalEditor = process.env.EDITOR;
      process.env.EDITOR = 'emacs';
      
      // Import fresh to get updated env
      const defaultConfig = DEFAULT_CONFIG;
      
      // Restore
      if (originalEditor) {
        process.env.EDITOR = originalEditor;
      } else {
        delete process.env.EDITOR;
      }
    });

    it('should have sensible default values', () => {
      expect(DEFAULT_CONFIG.git.autoPush).toBe(false);
      expect(DEFAULT_CONFIG.git.branch).toBe('main');
      expect(DEFAULT_CONFIG.browser.cdpUrl).toBe('http://localhost:9222');
      expect(DEFAULT_CONFIG.spacedRepetition.easyMultiplier).toBe(2.5);
      expect(DEFAULT_CONFIG.spacedRepetition.mediumMultiplier).toBe(1.5);
      expect(DEFAULT_CONFIG.spacedRepetition.hardMultiplier).toBe(1.0);
      expect(DEFAULT_CONFIG.spacedRepetition.maxInterval).toBe(180);
    });
  });
});
