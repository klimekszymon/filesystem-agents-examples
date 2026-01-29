/**
 * File storage for saving scrape results as markdown files.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { CONFIG } from '../../../src/config.js';

function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function sanitizeFilename(str) {
  return str
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .replace(/_+/g, '_')
    .substring(0, 100)
    .replace(/^[-_]+|[-_]+$/g, '');
}

function pathToSlug(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    if (!path || path === '/') {
      return 'index';
    }

    return sanitizeFilename(
      path
        .replace(/^\/|\/$/g, '')
        .replace(/\//g, '_')
        .replace(/\.[^.]+$/, '')
    );
  } catch {
    return 'page';
  }
}

function generateTimestampDir(includeTime = true) {
  const now = new Date();
  const datePart = now.toISOString().split('T')[0];

  if (!includeTime) {
    return datePart ?? '';
  }

  const timePart = now.toISOString().split('T')[1]?.substring(0, 8).replace(/:/g, '-') ?? '00-00-00';
  return `${datePart}/${timePart}`;
}

export class FileStorage {
  constructor() {
    this.defaultOutputDir = CONFIG.firecrawl.outputDir;
    this.relativePrefix = basename(this.defaultOutputDir);
  }

  async saveScrapeResult(url, content, options = {}) {
    const outputDir = options.outputDir ?? this.defaultOutputDir;
    const domain = extractDomain(url);
    const slug = pathToSlug(url);
    const dateDir = generateTimestampDir(false);

    const internalPath = join('scrape', dateDir, domain, `${slug}.md`);
    const absolutePath = join(outputDir, internalPath);
    const relativePath = join(this.relativePrefix, internalPath);

    const markdownContent = this.buildMarkdownWithFrontmatter(url, content);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, markdownContent, 'utf-8');

    return {
      filePath: relativePath,
      url,
      title: content.title,
    };
  }

  async saveBatchScrapeResults(results, options = {}) {
    const savedResults = [];

    for (const result of results) {
      try {
        const saved = await this.saveScrapeResult(result.url, result, options);
        savedResults.push(saved);
      } catch (error) {
        console.error(`Failed to save scrape result for ${result.url}:`, error.message);
      }
    }

    return savedResults;
  }

  buildMarkdownWithFrontmatter(url, content) {
    const frontmatter = {
      url,
      title: content.title ?? 'Untitled',
      scraped_at: new Date().toISOString(),
    };

    if (content.description) {
      frontmatter.description = content.description;
    }

    const frontmatterYaml = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (typeof value === 'string' && (value.includes(':') || value.includes('"'))) {
          return `${key}: "${value.replace(/"/g, '\\"')}"`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');

    const bodyContent = content.markdown ?? content.html ?? 'No content available';

    return `---
${frontmatterYaml}
---

${bodyContent}
`;
  }
}

export const fileStorage = new FileStorage();
