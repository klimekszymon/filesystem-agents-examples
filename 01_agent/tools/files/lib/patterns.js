/**
 * Pattern matching utilities with multiple modes.
 */

/**
 * Preset patterns for common Obsidian/Markdown patterns.
 */
export const PRESET_PATTERNS = {
  wikilinks: {
    pattern: '\\[\\[([^\\]|]+)(\\|[^\\]]+)?\\]\\]',
    flags: 'g',
  },
  tags: {
    pattern: '(?<=\\s|^)#[a-zA-Z][a-zA-Z0-9_/]*',
    flags: 'gm',
  },
  tasks: {
    pattern: '^\\s*-\\s*\\[([ xX])\\]\\s+(.*)$',
    flags: 'gm',
  },
  tasks_open: {
    pattern: '^\\s*-\\s*\\[ \\]\\s+(.*)$',
    flags: 'gm',
  },
  tasks_done: {
    pattern: '^\\s*-\\s*\\[[xX]\\]\\s+(.*)$',
    flags: 'gm',
  },
  headings: {
    pattern: '^(#{1,6})\\s+(.+)$',
    flags: 'gm',
  },
  codeblocks: {
    pattern: '```[\\s\\S]*?```',
    flags: 'g',
  },
  frontmatter: {
    pattern: '^---\\n[\\s\\S]*?\\n---',
    flags: 'm',
  },
};

/**
 * Check if a string is a valid preset pattern name.
 */
export function isPresetPattern(pattern) {
  return pattern in PRESET_PATTERNS;
}

/**
 * Build regex from a preset pattern.
 */
export function buildPresetPattern(preset) {
  const { pattern, flags } = PRESET_PATTERNS[preset];
  return new RegExp(pattern, flags);
}

/**
 * Escape special regex characters.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize whitespace for fuzzy matching.
 */
function normalizeWhitespace(str) {
  return str
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .replace(/ \n/g, '\n')
    .trim();
}

/**
 * Build a regex from pattern based on mode.
 */
export function buildPattern(pattern, mode, options = {}) {
  let source;
  let flags = 'g';

  if (options.multiline) {
    flags += 's';
  }

  if (options.caseInsensitive) {
    flags += 'i';
  }

  switch (mode) {
    case 'literal':
      source = escapeRegex(pattern);
      break;

    case 'regex':
      source = pattern;
      break;

    case 'fuzzy': {
      const normalized = normalizeWhitespace(pattern);
      source = escapeRegex(normalized).replace(/ /g, '\\s+').replace(/\n/g, '\\s*\\n\\s*');
      break;
    }
  }

  if (options.wholeWord) {
    source = `\\b${source}\\b`;
  }

  return new RegExp(source, flags);
}

/**
 * Find all matches of a pattern in content.
 */
export function findMatches(content, pattern, mode, options = {}) {
  const regex = buildPattern(pattern, mode, options);
  const matches = [];
  const maxMatches = options.maxMatches ?? 1000;

  let match = regex.exec(content);
  while (match !== null && matches.length < maxMatches) {
    const index = match.index;
    const text = match[0];

    const beforeMatch = content.slice(0, index);
    const lines = beforeMatch.split('\n');
    const line = lines.length;
    const column = (lines[lines.length - 1]?.length ?? 0) + 1;

    matches.push({ index, text, line, column });

    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    match = regex.exec(content);
  }

  return matches;
}

/**
 * Find a single match, or return null if not found or multiple matches.
 */
export function findUniqueMatch(content, pattern, mode, options = {}) {
  const matches = findMatches(content, pattern, mode, { ...options, maxMatches: 10 });

  if (matches.length === 0) {
    return { error: 'not_found' };
  }

  if (matches.length > 1) {
    return {
      error: 'multiple',
      count: matches.length,
      lines: matches.map((m) => m.line),
    };
  }

  const match = matches[0];
  if (!match) {
    return { error: 'not_found' };
  }
  return { match };
}

/**
 * Get line bounds for a given position.
 */
export function getLineBounds(content, index) {
  const lineStart = content.lastIndexOf('\n', index - 1) + 1;
  let lineEnd = content.indexOf('\n', index);
  if (lineEnd === -1) lineEnd = content.length;
  return { start: lineStart, end: lineEnd };
}

/**
 * Get the line number for a given index.
 */
export function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

/**
 * Find all matches using a preset pattern.
 */
export function findPresetMatches(content, preset, options = {}) {
  const regex = buildPresetPattern(preset);
  const matches = [];
  const maxMatches = options.maxMatches ?? 1000;

  let match = regex.exec(content);
  while (match !== null && matches.length < maxMatches) {
    const index = match.index;
    const text = match[0];

    const beforeMatch = content.slice(0, index);
    const lines = beforeMatch.split('\n');
    const line = lines.length;
    const column = (lines[lines.length - 1]?.length ?? 0) + 1;

    matches.push({ index, text, line, column });

    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    match = regex.exec(content);
  }

  return matches;
}

/**
 * Replace all occurrences of a pattern in content.
 */
export function replaceAllMatches(content, pattern, replacement, mode, options = {}) {
  const matches = findMatches(content, pattern, mode, { ...options, maxMatches: 10000 });

  if (matches.length === 0) {
    return { newContent: content, count: 0, affectedLines: [] };
  }

  let newContent = content;
  const affectedLines = new Set();

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    if (!match) continue;

    newContent =
      newContent.slice(0, match.index) +
      replacement +
      newContent.slice(match.index + match.text.length);
    affectedLines.add(match.line);
  }

  return {
    newContent,
    count: matches.length,
    affectedLines: Array.from(affectedLines).sort((a, b) => a - b),
  };
}
