/**
 * Tools Registry - exports all tools and provides executor.
 */

import * as fsRead from './files/fs-read.js';
import * as fsWrite from './files/fs-write.js';
import * as scrape from './web/scrape.js';
import * as send from './email/send.js';

// Tool registry
const registry = {
  fs_read: fsRead,
  fs_write: fsWrite,
  scrape: scrape,
  send: send,
};

// Export schemas for OpenAI
export const tools = Object.values(registry).map((t) => t.schema);

/**
 * Execute a tool by name.
 */
export async function executeTool(name, args) {
  const tool = registry[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return await tool.execute(args);
}

/**
 * Read a file from workspace (for @workspace: references).
 */
export async function readFile(path) {
  const result = await fsRead.execute({ path });
  const data = JSON.parse(result);

  if (data.type === 'file' && data.content?.text) {
    // Strip line numbers
    return data.content.text
      .split('\n')
      .map((line) => line.replace(/^\s*\d+\|/, ''))
      .join('\n');
  }

  throw new Error(`Could not read file: ${path}`);
}
