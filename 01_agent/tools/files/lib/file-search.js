/**
 * Fuzzy File Search Engine
 * Simplified version without fuzzysort dependency.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createIgnoreMatcherForDir } from './ignore.js';
import { shouldExclude } from './filetypes.js';

/** Directories to always exclude */
const ALWAYS_EXCLUDE = [
  '.git', 'node_modules', '.svelte-kit', '.next', '.nuxt',
  '__pycache__', 'target', 'dist', '.agent-data',
];

/**
 * Simple fuzzy match - check if all query chars appear in order.
 */
function fuzzyMatch(query, target) {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();
  
  let queryIdx = 0;
  const indices = [];
  
  for (let i = 0; i < targetLower.length && queryIdx < queryLower.length; i++) {
    if (targetLower[i] === queryLower[queryIdx]) {
      indices.push(i);
      queryIdx++;
    }
  }
  
  if (queryIdx !== queryLower.length) {
    return null; // Not all chars matched
  }
  
  // Score: prefer consecutive matches and matches at word boundaries
  let score = 0;
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    // Bonus for consecutive
    if (i > 0 && indices[i - 1] === idx - 1) {
      score += 10;
    }
    // Bonus for word boundary
    if (idx === 0 || targetLower[idx - 1] === '/' || targetLower[idx - 1] === '_' || targetLower[idx - 1] === '-') {
      score += 5;
    }
  }
  
  // Penalty for longer paths
  score -= target.split('/').length * 2;
  
  return { score, indices };
}

/**
 * Search files with fuzzy matching.
 */
export async function searchFiles(root, query, options = {}) {
  const maxResults = options.maxResults ?? 50;
  const includeDirectories = options.includeDirectories ?? false;
  const respectIgnore = options.respectIgnore ?? true;
  const exclude = options.exclude ?? [];
  const maxDepth = options.maxDepth ?? 10;

  const ignoreMatcher = respectIgnore ? await createIgnoreMatcherForDir(root) : null;
  const entries = [];

  const walk = async (dir, relDir, currentDepth) => {
    if (currentDepth > maxDepth) return;

    let items;
    try {
      items = await fs.readdir(dir);
    } catch {
      return;
    }

    for (const item of items) {
      if (item.startsWith('.')) continue;
      if (ALWAYS_EXCLUDE.includes(item)) continue;

      const itemPath = path.join(dir, item);
      const itemRelPath = relDir ? path.join(relDir, item).replace(/\\/g, '/') : item;

      if (ignoreMatcher?.isIgnored(itemRelPath)) continue;
      if (exclude.length > 0 && shouldExclude(itemRelPath, exclude)) continue;

      try {
        const stat = await fs.stat(itemPath);

        if (stat.isDirectory()) {
          if (includeDirectories) {
            entries.push({
              relativePath: itemRelPath,
              fileName: item,
              isDirectory: true,
              extension: '',
            });
          }
          await walk(itemPath, itemRelPath, currentDepth + 1);
        } else if (stat.isFile()) {
          entries.push({
            relativePath: itemRelPath,
            fileName: item,
            isDirectory: false,
            extension: path.extname(item).slice(1).toLowerCase(),
          });
        }
      } catch {
        // Skip inaccessible
      }
    }
  };

  await walk(root, '', 0);

  // Score and filter
  const queryLower = query.toLowerCase().trim();
  const scored = [];

  for (const entry of entries) {
    if (!queryLower) {
      // No query - return all, prefer shallow
      scored.push({
        ...entry,
        absolutePath: path.join(root, entry.relativePath),
        score: 100 - entry.relativePath.split('/').length * 10,
        matchIndices: [],
      });
      continue;
    }

    // Try matching filename first
    const nameMatch = fuzzyMatch(queryLower, entry.fileName);
    const pathMatch = fuzzyMatch(queryLower, entry.relativePath);

    if (nameMatch || pathMatch) {
      const score = (nameMatch?.score ?? -1000) * 2 + (pathMatch?.score ?? 0);
      scored.push({
        ...entry,
        absolutePath: path.join(root, entry.relativePath),
        score,
        matchIndices: nameMatch?.indices ?? pathMatch?.indices ?? [],
      });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxResults);
}

/**
 * Try to auto-resolve a file path by searching for the filename.
 */
export async function tryAutoResolve(root, relativePath, options = {}) {
  const fileName = path.basename(relativePath);
  if (!fileName) {
    return { resolved: false, resolvedPath: null, candidates: [], ambiguous: false };
  }

  const results = await searchFiles(root, fileName, { ...options, maxResults: 10 });
  const fileNameLower = fileName.toLowerCase();
  
  const matches = results.filter(
    (e) => !e.isDirectory && e.fileName.toLowerCase() === fileNameLower
  );

  if (matches.length === 0) {
    return { resolved: false, resolvedPath: null, candidates: [], ambiguous: false };
  }

  if (matches.length === 1) {
    return {
      resolved: true,
      resolvedPath: matches[0].relativePath,
      candidates: [matches[0].relativePath],
      ambiguous: false,
    };
  }

  return {
    resolved: false,
    resolvedPath: null,
    candidates: matches.map((m) => m.relativePath),
    ambiguous: true,
  };
}
