/**
 * fs_write Tool - Create, modify, or delete files.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  resolvePath,
  isTextFile,
  generateChecksum,
  generateDiff,
  parseLineRange,
  replaceLines,
  insertBeforeLine,
  insertAfterLine,
  deleteLines,
  findUniqueMatch,
  replaceAllMatches,
} from './lib/index.js';

export const schema = {
  type: 'function',
  name: 'fs_write',
  description: `Create, modify, or delete files.

OPERATIONS:
- create: Make new file (fails if exists)
- update: Modify existing file (requires action)
- delete: Remove file permanently

ACTIONS (for update):
- replace: Replace target lines/pattern with new content
- insert_before: Add content before target
- insert_after: Add content after target
- delete_lines: Remove target lines

SAFETY: Always use dryRun=true first to preview changes.`,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file',
      },
      operation: {
        type: 'string',
        enum: ['create', 'update', 'delete'],
        description: 'Operation type',
      },
      action: {
        type: 'string',
        enum: ['replace', 'insert_before', 'insert_after', 'delete_lines'],
        description: 'Action for update operation',
      },
      content: {
        type: 'string',
        description: 'Content to write (required for create/replace/insert)',
      },
      lines: {
        type: 'string',
        description: 'Target lines for update. Format: "10" or "10-15"',
      },
      pattern: {
        type: 'string',
        description: 'Target content by pattern',
      },
      patternMode: {
        type: 'string',
        enum: ['literal', 'regex', 'fuzzy'],
        description: 'Pattern interpretation mode',
      },
      replaceAll: {
        type: 'boolean',
        description: 'Replace all occurrences (not just first)',
      },
      checksum: {
        type: 'string',
        description: 'Expected checksum from previous fs_read',
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview changes without applying',
      },
    },
    required: ['path', 'operation'],
  },
};

async function fileExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function createFile(absPath, relativePath, content, options) {
  if (await fileExists(absPath)) {
    return {
      success: false,
      path: relativePath,
      operation: 'create',
      applied: false,
      error: { code: 'ALREADY_EXISTS', message: `File already exists: ${relativePath}` },
      hint: 'Use operation="update" to modify existing files.',
    };
  }

  if (options.dryRun) {
    const diff = generateDiff('', content, relativePath);
    return {
      success: true,
      path: relativePath,
      operation: 'create',
      applied: false,
      result: { action: 'would_create', linesAffected: content.split('\n').length, diff },
      hint: 'DRY RUN — run with dryRun=false to apply.',
    };
  }

  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, 'utf8');
  const newChecksum = generateChecksum(content);

  return {
    success: true,
    path: relativePath,
    operation: 'create',
    applied: true,
    result: { action: 'created', linesAffected: content.split('\n').length, newChecksum },
    hint: `File created. New checksum: ${newChecksum}`,
  };
}

async function deleteFile(absPath, relativePath, dryRun) {
  if (!(await fileExists(absPath))) {
    return {
      success: false,
      path: relativePath,
      operation: 'delete',
      applied: false,
      error: { code: 'NOT_FOUND', message: `File does not exist: ${relativePath}` },
    };
  }

  if (dryRun) {
    return {
      success: true,
      path: relativePath,
      operation: 'delete',
      applied: false,
      result: { action: 'would_delete' },
      hint: 'DRY RUN — run with dryRun=false to delete.',
    };
  }

  await fs.unlink(absPath);

  return {
    success: true,
    path: relativePath,
    operation: 'delete',
    applied: true,
    result: { action: 'deleted' },
    hint: 'File deleted.',
  };
}

async function updateFile(absPath, relativePath, input) {
  if (!(await fileExists(absPath))) {
    return {
      success: false,
      path: relativePath,
      operation: 'update',
      applied: false,
      error: { code: 'NOT_FOUND', message: `File does not exist: ${relativePath}` },
      hint: 'Use operation="create" to create new files.',
    };
  }

  if (!isTextFile(absPath)) {
    return {
      success: false,
      path: relativePath,
      operation: 'update',
      applied: false,
      error: { code: 'NOT_TEXT', message: 'Cannot modify binary files' },
    };
  }

  if (!input.action) {
    return {
      success: false,
      path: relativePath,
      operation: 'update',
      applied: false,
      error: { code: 'MISSING_ACTION', message: 'action is required for update' },
    };
  }

  const currentContent = await fs.readFile(absPath, 'utf8');
  const currentChecksum = generateChecksum(currentContent);

  if (input.checksum && input.checksum !== currentChecksum) {
    return {
      success: false,
      path: relativePath,
      operation: 'update',
      applied: false,
      error: { code: 'CHECKSUM_MISMATCH', message: `File changed. Current checksum: ${currentChecksum}` },
      hint: 'Re-read the file to get current content.',
    };
  }

  let targetStart, targetEnd;
  let patternMatch = null;

  if (input.lines) {
    const range = parseLineRange(input.lines);
    if (!range) {
      return {
        success: false,
        path: relativePath,
        operation: 'update',
        applied: false,
        error: { code: 'INVALID_RANGE', message: `Invalid line range: ${input.lines}` },
      };
    }

    const lines = currentContent.split('\n');
    if (range.start > lines.length) {
      return {
        success: false,
        path: relativePath,
        operation: 'update',
        applied: false,
        error: { code: 'OUT_OF_RANGE', message: `Line ${range.start} beyond file end (${lines.length} lines)` },
      };
    }

    targetStart = range.start;
    targetEnd = Math.min(range.end, lines.length);
  } else if (input.pattern) {
    if (input.replaceAll && input.action === 'replace') {
      const result = replaceAllMatches(
        currentContent,
        input.pattern,
        input.content ?? '',
        input.patternMode ?? 'literal',
        { caseInsensitive: input.caseInsensitive }
      );

      if (result.count === 0) {
        return {
          success: false,
          path: relativePath,
          operation: 'update',
          applied: false,
          error: { code: 'PATTERN_NOT_FOUND', message: `Pattern not found: "${input.pattern}"` },
        };
      }

      const diff = generateDiff(currentContent, result.newContent, relativePath);

      if (input.dryRun) {
        return {
          success: true,
          path: relativePath,
          operation: 'update',
          applied: false,
          result: { action: 'would_replace_all', linesAffected: result.affectedLines.length, diff },
          hint: `DRY RUN — would replace ${result.count} occurrences.`,
        };
      }

      await fs.writeFile(absPath, result.newContent, 'utf8');
      const newChecksum = generateChecksum(result.newContent);

      return {
        success: true,
        path: relativePath,
        operation: 'update',
        applied: true,
        result: { action: 'replaced_all', linesAffected: result.affectedLines.length, newChecksum, diff },
        hint: `Replaced ${result.count} occurrences. New checksum: ${newChecksum}`,
      };
    }

    const matchResult = findUniqueMatch(currentContent, input.pattern, input.patternMode ?? 'literal', {
      caseInsensitive: input.caseInsensitive,
    });

    if (matchResult.error === 'not_found') {
      return {
        success: false,
        path: relativePath,
        operation: 'update',
        applied: false,
        error: { code: 'PATTERN_NOT_FOUND', message: `Pattern not found: "${input.pattern}"` },
      };
    }

    if (matchResult.error === 'multiple') {
      return {
        success: false,
        path: relativePath,
        operation: 'update',
        applied: false,
        error: { code: 'MULTIPLE_MATCHES', message: `Pattern matched ${matchResult.count} times at lines ${matchResult.lines.join(', ')}` },
        hint: 'Use replaceAll=true or specify lines="N" to target specific match.',
      };
    }

    const match = matchResult.match;
    targetStart = match.line;
    targetEnd = match.line + match.text.split('\n').length - 1;
    patternMatch = match;
  } else {
    return {
      success: false,
      path: relativePath,
      operation: 'update',
      applied: false,
      error: { code: 'NO_TARGET', message: 'Either lines or pattern must be specified' },
    };
  }

  let newContent;
  let actionDescription;
  let linesAffected;
  const content = input.content ?? '';

  switch (input.action) {
    case 'replace':
      if (patternMatch) {
        newContent =
          currentContent.slice(0, patternMatch.index) +
          content +
          currentContent.slice(patternMatch.index + patternMatch.text.length);
        linesAffected = Math.max(patternMatch.text.split('\n').length, content.split('\n').length);
      } else {
        newContent = replaceLines(currentContent, targetStart, targetEnd, content);
        linesAffected = targetEnd - targetStart + 1;
      }
      actionDescription = 'replaced';
      break;

    case 'insert_before':
      newContent = insertBeforeLine(currentContent, targetStart, content);
      actionDescription = 'inserted_before';
      linesAffected = content.split('\n').length;
      break;

    case 'insert_after':
      newContent = insertAfterLine(currentContent, targetEnd, content);
      actionDescription = 'inserted_after';
      linesAffected = content.split('\n').length;
      break;

    case 'delete_lines':
      newContent = deleteLines(currentContent, targetStart, targetEnd);
      actionDescription = 'deleted_lines';
      linesAffected = targetEnd - targetStart + 1;
      break;

    default:
      return {
        success: false,
        path: relativePath,
        operation: 'update',
        applied: false,
        error: { code: 'INVALID_ACTION', message: `Unknown action: ${input.action}` },
      };
  }

  const diff = generateDiff(currentContent, newContent, relativePath);

  if (input.dryRun) {
    return {
      success: true,
      path: relativePath,
      operation: 'update',
      applied: false,
      result: { action: `would_${actionDescription}`, linesAffected, diff },
      hint: 'DRY RUN — run with dryRun=false to apply.',
    };
  }

  await fs.writeFile(absPath, newContent, 'utf8');
  const newChecksum = generateChecksum(newContent);

  return {
    success: true,
    path: relativePath,
    operation: 'update',
    applied: true,
    result: { action: actionDescription, linesAffected, newChecksum, diff },
    hint: `${actionDescription} ${linesAffected} line(s). New checksum: ${newChecksum}`,
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
  let result;

  switch (args.operation) {
    case 'create':
      if (!args.content) {
        return JSON.stringify({
          success: false,
          path: virtualPath,
          operation: 'create',
          error: { code: 'MISSING_CONTENT', message: 'content is required for create' },
        });
      }
      result = await createFile(absolutePath, virtualPath, args.content, { dryRun: args.dryRun });
      break;

    case 'delete':
      result = await deleteFile(absolutePath, virtualPath, args.dryRun);
      break;

    case 'update':
      result = await updateFile(absolutePath, virtualPath, args);
      break;

    default:
      result = {
        success: false,
        path: virtualPath,
        error: { code: 'INVALID_OPERATION', message: `Unknown operation: ${args.operation}` },
      };
  }

  return JSON.stringify(result);
}
