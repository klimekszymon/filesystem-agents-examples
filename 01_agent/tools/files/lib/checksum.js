/**
 * Checksum utilities for file integrity verification.
 */

import { createHash } from 'node:crypto';

/**
 * Generate a short checksum for content verification.
 * Uses first 12 characters of SHA256 hash.
 */
export function generateChecksum(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 12);
}

/**
 * Verify that content matches an expected checksum.
 */
export function verifyChecksum(content, expected) {
  return generateChecksum(content) === expected;
}
