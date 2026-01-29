/**
 * Ignore file handling (.gitignore, .ignore).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/** Default patterns to always ignore */
const DEFAULT_IGNORE = [
  '.*',
  'node_modules',
  'Thumbs.db',
  '*.swp',
  '*.swo',
  '*~',
];

/**
 * Parse ignore file content into patterns.
 */
function parseIgnorePatterns(content) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/**
 * Convert glob pattern to regex.
 */
function globToRegex(pattern) {
  let regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\?/g, '[^/]');

  if (pattern.endsWith('/')) {
    regex = `${regex.slice(0, -2)}(/.*)?$`;
  } else {
    regex = `(^|/)${regex}(/.*)?$`;
  }

  return new RegExp(regex);
}

/**
 * Create an ignore matcher from patterns.
 */
export function createIgnoreMatcher(patterns) {
  const allPatterns = [...DEFAULT_IGNORE, ...patterns];
  const regexes = allPatterns.map((p) => ({
    pattern: p,
    regex: globToRegex(p),
    negated: p.startsWith('!'),
  }));

  return {
    isIgnored(relativePath) {
      let ignored = false;

      for (const { regex, negated } of regexes) {
        if (regex.test(relativePath)) {
          ignored = !negated;
        }
      }

      return ignored;
    },
  };
}

/**
 * Load ignore patterns from a directory.
 */
export async function loadIgnorePatterns(dir) {
  const patterns = [];

  for (const filename of ['.gitignore', '.ignore']) {
    try {
      const content = await fs.readFile(path.join(dir, filename), 'utf8');
      patterns.push(...parseIgnorePatterns(content));
    } catch {
      // File doesn't exist, that's fine
    }
  }

  return patterns;
}

/**
 * Create an ignore matcher for a directory.
 */
export async function createIgnoreMatcherForDir(dir) {
  const patterns = await loadIgnorePatterns(dir);
  return createIgnoreMatcher(patterns);
}
