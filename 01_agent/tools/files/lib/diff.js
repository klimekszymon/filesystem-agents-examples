/**
 * Unified diff generation for change preview.
 */

/**
 * Generate a unified diff between two strings.
 */
export function generateDiff(oldContent, newContent, filename = 'file') {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const hunks = [];
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    while (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      i++;
      j++;
    }

    if (i >= oldLines.length && j >= newLines.length) break;

    const hunkStartOld = Math.max(0, i - 3);
    const hunkStartNew = Math.max(0, j - 3);

    const hunkLines = [];

    for (let k = hunkStartOld; k < i; k++) {
      hunkLines.push(` ${oldLines[k]}`);
    }

    let oldEnd = i;
    let newEnd = j;
    let contextAfter = 0;

    while (oldEnd < oldLines.length || newEnd < newLines.length) {
      if (
        oldEnd < oldLines.length &&
        newEnd < newLines.length &&
        oldLines[oldEnd] === newLines[newEnd]
      ) {
        contextAfter++;
        if (contextAfter >= 3) break;
        oldEnd++;
        newEnd++;
      } else {
        contextAfter = 0;
        if (
          oldEnd < oldLines.length &&
          (newEnd >= newLines.length || oldLines[oldEnd] !== newLines[newEnd])
        ) {
          oldEnd++;
        }
        if (
          newEnd < newLines.length &&
          (oldEnd >= oldLines.length || oldLines[oldEnd - 1] !== newLines[newEnd])
        ) {
          newEnd++;
        }
      }
    }

    for (let k = i; k < oldEnd - contextAfter; k++) {
      hunkLines.push(`-${oldLines[k]}`);
    }

    for (let k = j; k < newEnd - contextAfter; k++) {
      hunkLines.push(`+${newLines[k]}`);
    }

    for (let k = 0; k < contextAfter && oldEnd - contextAfter + k < oldLines.length; k++) {
      hunkLines.push(` ${oldLines[oldEnd - contextAfter + k]}`);
    }

    if (hunkLines.length > 0) {
      const header = `@@ -${hunkStartOld + 1},${oldEnd - hunkStartOld} +${hunkStartNew + 1},${newEnd - hunkStartNew} @@`;
      hunks.push(`${header}\n${hunkLines.join('\n')}`);
    }

    i = oldEnd;
    j = newEnd;
  }

  if (hunks.length === 0) {
    return '(no changes)';
  }

  return `--- a/${filename}\n+++ b/${filename}\n${hunks.join('\n')}`;
}

/**
 * Count lines added and removed in a diff.
 */
export function countDiffLines(diff) {
  const lines = diff.split('\n');
  let added = 0;
  let removed = 0;

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) added++;
    if (line.startsWith('-') && !line.startsWith('---')) removed++;
  }

  return { added, removed };
}
