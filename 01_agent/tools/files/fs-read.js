/**
 * fs_read Tool - Read files, list directories, search content.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  resolvePath,
  getWorkspaceRoot,
  isTextFile,
  matchesType,
  shouldExclude,
  createIgnoreMatcherForDir,
  generateChecksum,
  addLineNumbers,
  extractLines,
  parseLineRange,
  findMatches,
  findPresetMatches,
  isPresetPattern,
  searchFiles,
  tryAutoResolve,
} from './lib/index.js';

export const schema = {
  type: 'function',
  name: 'fs_read',
  description: `Read files, list directories, find files by name, or search content.

MODES:
1. DIRECTORY - path to directory: returns tree structure
2. FILE - path to file: returns content with line numbers and checksum
3. FIND - path + find: fuzzy search for files by name
4. SEARCH - path + pattern/preset: search content in files

Examples:
- { "path": "." } - list workspace root
- { "path": "src/index.js" } - read file
- { "path": ".", "find": "config" } - find files named config
- { "path": ".", "pattern": "TODO" } - search for TODO in all files`,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to file or directory',
      },
      pattern: {
        type: 'string',
        description: 'Search pattern to find within files',
      },
      preset: {
        type: 'string',
        enum: ['wikilinks', 'tags', 'tasks', 'tasks_open', 'tasks_done', 'headings', 'codeblocks', 'frontmatter'],
        description: 'Preset pattern for common Markdown searches',
      },
      patternMode: {
        type: 'string',
        enum: ['literal', 'regex', 'fuzzy'],
        description: 'How to interpret pattern. Default: literal',
      },
      find: {
        type: 'string',
        description: 'Fuzzy find files by name',
      },
      lines: {
        type: 'string',
        description: 'Limit file reading to specific lines. Format: "10" or "10-50"',
      },
      depth: {
        type: 'number',
        description: 'Directory traversal depth. Default: 1 for listing, 5 for search',
      },
      context: {
        type: 'number',
        description: 'Lines of context around search matches. Default: 3',
      },
    },
    required: ['path'],
  },
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function listDirectory(absPath, relativePath, depth, options) {
  const entries = [];
  let truncated = false;
  const maxFiles = options.maxFiles ?? 500;

  const ignoreMatcher = options.respectIgnore !== false ? await createIgnoreMatcherForDir(absPath) : null;

  async function walk(dir, relDir, currentDepth) {
    if (currentDepth > depth || entries.length >= maxFiles) {
      truncated = entries.length >= maxFiles;
      return;
    }

    let items;
    try {
      items = await fs.readdir(dir);
    } catch {
      return;
    }

    for (const item of items) {
      if (entries.length >= maxFiles) {
        truncated = true;
        break;
      }

      const itemPath = path.join(dir, item);
      const itemRelPath = path.join(relDir, item);

      if (ignoreMatcher?.isIgnored(itemRelPath)) continue;
      if (options.exclude && shouldExclude(itemRelPath, options.exclude)) continue;

      try {
        const stat = await fs.stat(itemPath);

        if (stat.isDirectory()) {
          let childCount = 0;
          try {
            childCount = (await fs.readdir(itemPath)).length;
          } catch {}

          entries.push({
            path: itemRelPath,
            kind: 'directory',
            children: childCount,
          });

          if (currentDepth < depth) {
            await walk(itemPath, itemRelPath, currentDepth + 1);
          }
        } else if (stat.isFile()) {
          if (options.types?.length && !matchesType(item, options.types)) continue;

          entries.push({
            path: itemRelPath,
            kind: 'file',
            size: formatSize(stat.size),
          });
        }
      } catch {}
    }
  }

  await walk(absPath, relativePath === '.' ? '' : relativePath, 1);
  return { entries, truncated };
}

async function readFile(absPath, relativePath, options) {
  if (!isTextFile(absPath)) {
    return {
      success: false,
      path: relativePath,
      type: 'file',
      error: { code: 'NOT_TEXT', message: 'Cannot read binary files' },
      hint: 'Only text files can be read.',
    };
  }

  let content;
  try {
    content = await fs.readFile(absPath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      return {
        success: false,
        path: relativePath,
        type: 'file',
        error: { code: 'NOT_FOUND', message: `File does not exist: ${relativePath}` },
        hint: 'Use fs_read on parent directory to see available files.',
      };
    }
    return {
      success: false,
      path: relativePath,
      type: 'file',
      error: { code: 'IO_ERROR', message: e.message },
    };
  }

  const checksum = generateChecksum(content);
  const totalLines = content.split('\n').length;
  let text = content;
  let range;
  let truncated = false;

  if (options.lines) {
    const parsedRange = parseLineRange(options.lines);
    if (!parsedRange) {
      return {
        success: false,
        path: relativePath,
        type: 'file',
        error: { code: 'INVALID_RANGE', message: `Invalid line range: ${options.lines}` },
      };
    }

    const extracted = extractLines(content, parsedRange.start, parsedRange.end);
    text = addLineNumbers(extracted.text, extracted.actualStart);
    range = { start: extracted.actualStart, end: extracted.actualEnd };
  } else {
    const PREVIEW_LINES = 100;
    if (totalLines > PREVIEW_LINES) {
      const extracted = extractLines(content, 1, PREVIEW_LINES);
      text = addLineNumbers(extracted.text);
      truncated = true;
      range = { start: 1, end: PREVIEW_LINES };
    } else {
      text = addLineNumbers(content);
    }
  }

  return {
    success: true,
    path: relativePath,
    type: 'file',
    content: { text, checksum, totalLines, range, truncated },
    hint: truncated
      ? `Large file (${totalLines} lines), showing 1-${range?.end}. Use lines="101-200" for more. Checksum: ${checksum}`
      : `Checksum: ${checksum} (required for fs_write)`,
  };
}

async function searchInSingleFile(absPath, relativePath, searchPattern, options) {
  const context = options.context ?? 3;
  const maxMatches = options.maxMatches ?? 100;
  const isPreset = options.isPreset;

  if (!isTextFile(absPath)) {
    return {
      success: false,
      path: relativePath,
      type: 'search',
      error: { code: 'NOT_TEXT', message: 'Cannot search in binary files' },
    };
  }

  const content = await fs.readFile(absPath, 'utf8');
  const lines = content.split('\n');
  const matches = [];

  let fileMatches;
  if (isPreset && isPresetPattern(searchPattern)) {
    fileMatches = findPresetMatches(content, searchPattern, { maxMatches });
  } else {
    fileMatches = findMatches(content, searchPattern, options.patternMode ?? 'literal', {
      caseInsensitive: options.caseInsensitive,
      maxMatches,
    });
  }

  for (const match of fileMatches) {
    const beforeStart = Math.max(0, match.line - 1 - context);
    const afterEnd = Math.min(lines.length, match.line + context);

    matches.push({
      file: relativePath,
      line: match.line,
      text: match.text,
      context: {
        before: lines.slice(beforeStart, match.line - 1).map((l, i) => `${beforeStart + i + 1}|${l}`),
        match: [`${match.line}|${lines[match.line - 1]}`],
        after: lines.slice(match.line, afterEnd).map((l, i) => `${match.line + i + 1}|${l}`),
      },
    });
  }

  return {
    success: true,
    path: relativePath,
    type: 'search',
    matches,
    matchCount: matches.length,
    hint: matches.length === 0
      ? `No matches found for "${searchPattern}"`
      : `Found ${matches.length} matches`,
  };
}

async function searchInDirectory(absPath, relativePath, searchPattern, options) {
  const matches = [];
  const context = options.context ?? 3;
  const maxMatches = options.maxMatches ?? 100;
  const depth = options.depth ?? 5;
  const isPreset = options.isPreset;

  const ignoreMatcher = options.respectIgnore !== false ? await createIgnoreMatcherForDir(absPath) : null;

  async function walk(dir, relDir, currentDepth) {
    if (currentDepth > depth || matches.length >= maxMatches) return;

    let items;
    try {
      items = await fs.readdir(dir);
    } catch {
      return;
    }

    for (const item of items) {
      if (matches.length >= maxMatches) break;

      const itemPath = path.join(dir, item);
      const itemRelPath = relDir ? path.join(relDir, item) : item;

      if (ignoreMatcher?.isIgnored(itemRelPath)) continue;

      try {
        const stat = await fs.stat(itemPath);

        if (stat.isDirectory()) {
          await walk(itemPath, itemRelPath, currentDepth + 1);
        } else if (stat.isFile() && isTextFile(itemPath)) {
          const content = await fs.readFile(itemPath, 'utf8');
          const lines = content.split('\n');

          let fileMatches;
          if (isPreset && isPresetPattern(searchPattern)) {
            fileMatches = findPresetMatches(content, searchPattern, { maxMatches: maxMatches - matches.length });
          } else {
            fileMatches = findMatches(content, searchPattern, options.patternMode ?? 'literal', {
              caseInsensitive: options.caseInsensitive,
              maxMatches: maxMatches - matches.length,
            });
          }

          for (const match of fileMatches) {
            const beforeStart = Math.max(0, match.line - 1 - context);
            const afterEnd = Math.min(lines.length, match.line + context);

            matches.push({
              file: itemRelPath,
              line: match.line,
              text: match.text,
              context: {
                before: lines.slice(beforeStart, match.line - 1).map((l, i) => `${beforeStart + i + 1}|${l}`),
                match: [`${match.line}|${lines[match.line - 1]}`],
                after: lines.slice(match.line, afterEnd).map((l, i) => `${match.line + i + 1}|${l}`),
              },
            });
          }
        }
      } catch {}
    }
  }

  await walk(absPath, relativePath === '.' ? '' : relativePath, 1);

  return {
    success: true,
    path: relativePath,
    type: 'search',
    matches,
    matchCount: matches.length,
    hint: matches.length === 0
      ? `No matches found for "${searchPattern}"`
      : `Found ${matches.length} matches`,
  };
}

export async function execute(args) {
  const resolved = resolvePath(args.path);
  
  if (!resolved.ok) {
    return JSON.stringify({
      success: false,
      path: args.path,
      error: { code: 'INVALID_PATH', message: resolved.error },
    });
  }

  const { absolutePath, virtualPath } = resolved.resolved;
  const effectiveDepth = args.depth ?? (args.find || args.pattern || args.preset ? 5 : 1);

  let stat;
  try {
    stat = await fs.stat(absolutePath);
  } catch {
    // Try auto-resolve
    const autoResolve = await tryAutoResolve(getWorkspaceRoot(), virtualPath);
    
    if (autoResolve.resolved && autoResolve.resolvedPath) {
      const resolvedPath = path.join(getWorkspaceRoot(), autoResolve.resolvedPath);
      const result = await readFile(resolvedPath, autoResolve.resolvedPath, { lines: args.lines });
      result.hint = `Auto-resolved to "${autoResolve.resolvedPath}". ` + (result.hint ?? '');
      return JSON.stringify(result);
    }
    
    if (autoResolve.ambiguous) {
      return JSON.stringify({
        success: false,
        path: virtualPath,
        error: { code: 'AMBIGUOUS', message: `Multiple files match` },
        candidates: autoResolve.candidates,
      });
    }

    return JSON.stringify({
      success: false,
      path: virtualPath,
      type: 'file',
      error: { code: 'NOT_FOUND', message: `Path does not exist: ${virtualPath}` },
    });
  }

  // Find files by name
  if (args.find) {
    const results = await searchFiles(absolutePath, args.find, {
      maxResults: 50,
      includeDirectories: true,
      maxDepth: effectiveDepth,
    });

    return JSON.stringify({
      success: true,
      path: virtualPath,
      type: 'directory',
      tree: {
        entries: results.map(r => ({ path: r.relativePath, kind: r.isDirectory ? 'directory' : 'file' })),
        summary: `Found ${results.length} items matching "${args.find}"`,
      },
    });
  }

  // Search content
  const searchPattern = args.pattern ?? args.preset;
  if (searchPattern) {
    const searchOptions = {
      patternMode: args.patternMode,
      context: args.context,
      depth: effectiveDepth,
      isPreset: Boolean(args.preset),
    };

    // Use appropriate search function based on file vs directory
    const result = stat.isFile()
      ? await searchInSingleFile(absolutePath, virtualPath, searchPattern, searchOptions)
      : await searchInDirectory(absolutePath, virtualPath, searchPattern, searchOptions);
    
    return JSON.stringify(result);
  }

  // Directory listing
  if (stat.isDirectory()) {
    const { entries, truncated } = await listDirectory(absolutePath, virtualPath, effectiveDepth, {});
    
    const fileCount = entries.filter(e => e.kind === 'file').length;
    const dirCount = entries.filter(e => e.kind === 'directory').length;

    return JSON.stringify({
      success: true,
      path: virtualPath,
      type: 'directory',
      tree: {
        entries,
        summary: `${entries.length} items (${fileCount} files, ${dirCount} directories)`,
      },
      truncated,
    });
  }

  // File reading
  if (stat.isFile()) {
    const result = await readFile(absolutePath, virtualPath, { lines: args.lines });
    return JSON.stringify(result);
  }

  return JSON.stringify({
    success: false,
    path: virtualPath,
    error: { code: 'INVALID_TYPE', message: 'Not a file or directory' },
  });
}
