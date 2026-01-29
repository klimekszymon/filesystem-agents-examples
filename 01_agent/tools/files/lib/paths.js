/**
 * Path resolution for filesystem tools.
 * Simplified version - single workspace root.
 */

import path from 'node:path';
import { CONFIG } from '../../../src/config.js';

/**
 * Check if a path segment attempts to escape (e.g., "..")
 */
function hasEscapeAttempt(pathStr) {
  const segments = pathStr.split(/[/\\]/);
  return segments.some((seg) => seg === '..');
}

/**
 * Check if a path is an absolute filesystem path.
 */
function isAbsolutePath(pathStr) {
  if (pathStr.startsWith('/')) return true;
  if (/^[a-zA-Z]:[/\\]/.test(pathStr)) return true;
  return false;
}

/**
 * Get the workspace root directory.
 */
export function getWorkspaceRoot() {
  return CONFIG.workspace.root;
}

/**
 * Resolve a virtual path to a real filesystem path.
 */
export function resolvePath(virtualPath) {
  const trimmed = virtualPath.trim();
  const root = getWorkspaceRoot();

  if (isAbsolutePath(trimmed)) {
    return {
      ok: false,
      error: `Absolute paths not allowed. Use relative paths within workspace.`,
    };
  }

  if (hasEscapeAttempt(trimmed)) {
    return { ok: false, error: 'Path cannot contain ".." segments' };
  }

  if (trimmed === '.' || trimmed === '' || trimmed === '/') {
    return {
      ok: true,
      resolved: {
        absolutePath: root,
        relativePath: '.',
        virtualPath: '.',
      },
    };
  }

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\/+/, '');
  const absolutePath = path.resolve(root, normalized);

  // Security check
  if (!absolutePath.startsWith(root + path.sep) && absolutePath !== root) {
    return { ok: false, error: 'Path is outside workspace' };
  }

  return {
    ok: true,
    resolved: {
      absolutePath,
      relativePath: normalized,
      virtualPath: normalized,
    },
  };
}

/**
 * Convert an absolute path back to a virtual path.
 */
export function toVirtualPath(absolutePath) {
  const root = getWorkspaceRoot();
  if (absolutePath === root) {
    return '.';
  }
  if (absolutePath.startsWith(root + path.sep)) {
    return absolutePath.slice(root.length + 1);
  }
  return null;
}
