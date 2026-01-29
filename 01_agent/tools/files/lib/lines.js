/**
 * Line-based content manipulation utilities.
 * All functions treat lines as 1-indexed (first line is line 1).
 */

/**
 * Parse a line range string into start/end numbers.
 */
export function parseLineRange(range) {
  const trimmed = range.trim();

  if (/^\d+$/.test(trimmed)) {
    const line = parseInt(trimmed, 10);
    return { start: line, end: line };
  }

  const match = trimmed.match(/^(\d+)-(\d+)$/);
  if (match?.[1] && match[2]) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (start <= end) {
      return { start, end };
    }
  }

  return null;
}

/**
 * Add line numbers to content for display.
 */
export function addLineNumbers(content, startLine = 1) {
  const lines = content.split('\n');
  const maxLineNum = startLine + lines.length - 1;
  const width = String(maxLineNum).length;

  return lines
    .map((line, i) => {
      const lineNum = String(startLine + i).padStart(width, ' ');
      return `${lineNum}|${line}`;
    })
    .join('\n');
}

/**
 * Extract a range of lines from content.
 */
export function extractLines(content, start, end) {
  const lines = content.split('\n');
  const actualStart = Math.max(1, start);
  const actualEnd = Math.min(lines.length, end);

  const extracted = lines.slice(actualStart - 1, actualEnd).join('\n');

  return {
    text: extracted,
    actualStart,
    actualEnd,
  };
}

/**
 * Get context lines around a target line.
 */
export function getContextLines(content, line, contextBefore, contextAfter) {
  const lines = content.split('\n');
  const lineIndex = line - 1;

  const beforeStart = Math.max(0, lineIndex - contextBefore);
  const afterEnd = Math.min(lines.length, lineIndex + 1 + contextAfter);

  return {
    before: lines.slice(beforeStart, lineIndex),
    after: lines.slice(lineIndex + 1, afterEnd),
  };
}

/**
 * Replace a range of lines with new content.
 */
export function replaceLines(content, start, end, replacement) {
  const lines = content.split('\n');
  const before = lines.slice(0, start - 1);
  const after = lines.slice(end);

  return [...before, replacement, ...after].join('\n');
}

/**
 * Insert content before a specific line.
 */
export function insertBeforeLine(content, line, insertion) {
  const lines = content.split('\n');
  const insertIndex = Math.max(0, line - 1);
  lines.splice(insertIndex, 0, insertion);
  return lines.join('\n');
}

/**
 * Insert content after a specific line.
 */
export function insertAfterLine(content, line, insertion) {
  const lines = content.split('\n');
  const insertIndex = Math.min(lines.length, line);
  lines.splice(insertIndex, 0, insertion);
  return lines.join('\n');
}

/**
 * Delete a range of lines from content.
 */
export function deleteLines(content, start, end) {
  const lines = content.split('\n');
  const before = lines.slice(0, start - 1);
  const after = lines.slice(end);
  return [...before, ...after].join('\n');
}
