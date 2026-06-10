/**
 * Utility functions for DSA Vault
 */

/**
 * Sanitizes a problem name to be a filesystem-safe kebab-case string.
 * Converts to lowercase, replaces whitespace/special chars with hyphens,
 * removes consecutive hyphens, and trims hyphens from start/end.
 * Handles unicode by attempting to normalize to ASCII where possible,
 * then stripping remaining non-alphanumeric characters.
 * 
 * @param title The original problem title
 * @returns A sanitized, filesystem-safe kebab-case string
 */
export const sanitizeProblemName = (title: string): string => {
  if (!title) return 'untitled';
  
  const sanitized = title
    .normalize('NFD') // Decompose combined graphemes into the combination of simple ones
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace any non-alphanumeric character with a hyphen
    .replace(/^-+|-+$/g, ''); // Trim hyphens from start and end
    
  return sanitized || 'untitled';
};

/**
 * Maps a programming language name to its standard file extension.
 * 
 * @param language The programming language name (e.g., 'python', 'javascript')
 * @returns The corresponding file extension (e.g., '.py', '.js')
 */
export const getFileExtension = (language: string): string => {
  const normalizedLang = language.toLowerCase().trim();
  
  const extensionMap: Record<string, string> = {
    python: '.py',
    python3: '.py',
    javascript: '.js',
    js: '.js',
    typescript: '.ts',
    ts: '.ts',
    java: '.java',
    cpp: '.cpp',
    'c++': '.cpp',
    c: '.c',
    csharp: '.cs',
    'c#': '.cs',
    go: '.go',
    rust: '.rs',
    ruby: '.rb',
    php: '.php',
    swift: '.swift',
    kotlin: '.kt',
    scala: '.scala',
  };

  return extensionMap[normalizedLang] || '.txt';
};
