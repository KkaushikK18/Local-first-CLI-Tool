/**
 * Configuration Management Service
 * 
 * Handles loading, saving, and validating configuration from config.json
 * Validates: Requirements 14.1, 14.6
 */

import { readFile, writeFile, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { validateConfig, type Config } from '../types/index.js';

/**
 * Default configuration with sensible defaults
 */
export function getDefaultConfig(): Config {
  return {
    git: {
      remoteUrl: null,
      autoPush: false,
      branch: 'main'
    },
    editor: {
      command: process.env.EDITOR || process.env.VISUAL || 'vim'
    },
    browser: {
      cdpUrl: 'http://localhost:9222',
      profile: null
    },
    spacedRepetition: {
      easyMultiplier: 2.5,
      mediumMultiplier: 1.5,
      hardMultiplier: 1.0,
      maxInterval: 180
    },
    defaults: {
      platform: null,
      language: null
    }
  };
}

export const DEFAULT_CONFIG: Config = getDefaultConfig();

export class ConfigService {
  private configPath: string;
  private config: Config | null = null;

  constructor(workspacePath: string) {
    this.configPath = join(workspacePath, 'config.json');
  }

  /**
   * Load configuration from config.json
   * If file doesn't exist, returns default configuration
   * If file is invalid, throws validation error
   */
  async load(): Promise<Config> {
    try {
      // Check if config file exists
      await access(this.configPath, constants.F_OK);
      
      // Read and parse config file
      const fileContent = await readFile(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(fileContent);
      
      // Validate against schema using the validation function
      const validationResult = validateConfig(parsedConfig);
      
      if (!validationResult.success) {
        throw new Error(`Configuration validation failed: ${Object.entries(validationResult.error.fieldErrors)
          .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
          .join('; ')}`);
      }
      
      this.config = validationResult.data;
      return this.config;
    } catch (error: any) {
      // If file doesn't exist, return default config
      if (error.code === 'ENOENT') {
        this.config = getDefaultConfig();
        return this.config;
      }
      
      // If JSON parsing failed
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in config file: ${error.message}`);
      }
      
      // Other errors (including validation errors)
      throw error;
    }
  }

  /**
   * Save configuration to config.json
   * Validates configuration before saving
   */
  async save(config: Config): Promise<void> {
    try {
      // Validate configuration
      const validationResult = validateConfig(config);
      
      if (!validationResult.success) {
        throw new Error(`Configuration validation failed: ${Object.entries(validationResult.error.fieldErrors)
          .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
          .join('; ')}`);
      }
      
      // Serialize to JSON with pretty printing
      const jsonContent = JSON.stringify(validationResult.data, null, 2);
      
      // Write to file
      await writeFile(this.configPath, jsonContent, 'utf-8');
      
      this.config = validationResult.data;
    } catch (error: any) {
      // Re-throw validation errors directly
      throw error;
    }
  }

  /**
   * Get current configuration
   * Loads from file if not already loaded
   */
  async get(): Promise<Config> {
    if (this.config === null) {
      return await this.load();
    }
    return this.config;
  }

  /**
   * Update a specific configuration value
   * Supports nested key paths using dot notation (e.g., "git.remoteUrl")
   */
  async set(keyPath: string, value: any): Promise<void> {
    // Load current config if not loaded
    if (this.config === null) {
      await this.load();
    }

    const config = { ...this.config! };
    const keys = keyPath.split('.');
    
    if (keys.length === 0) {
      throw new Error(`Invalid configuration key path: ${keyPath}`);
    }
    
    // Navigate to the nested property
    let current: any = config;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!key || !(key in current)) {
        throw new Error(`Invalid configuration key path: ${keyPath}`);
      }
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    if (!lastKey || !(lastKey in current)) {
      throw new Error(`Invalid configuration key path: ${keyPath}`);
    }
    
    // Set the value
    current[lastKey] = value;
    
    // Save the updated configuration (includes validation)
    await this.save(config);
  }

  /**
   * Reset configuration to defaults
   */
  async reset(): Promise<void> {
    await this.save(getDefaultConfig());
  }

  /**
   * Validate a configuration object without saving
   */
  static validate(config: unknown): { valid: boolean; errors?: string[] } {
    const result = validateConfig(config);
    
    if (result.success) {
      return { valid: true };
    }
    
    return {
      valid: false,
      errors: Object.entries(result.error.fieldErrors)
        .map(([field, errs]) => `${field}: ${errs.join(', ')}`)
    };
  }

  /**
   * Check if config file exists
   */
  async exists(): Promise<boolean> {
    try {
      await access(this.configPath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize config file with defaults if it doesn't exist
   */
  async initialize(): Promise<void> {
    const exists = await this.exists();
    if (!exists) {
      await this.save(getDefaultConfig());
    }
  }
}
