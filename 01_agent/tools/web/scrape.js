/**
 * scrape Tool - Scrape web pages and extract content.
 */

import { firecrawlClient } from './lib/firecrawl-client.js';
import { fileStorage } from './lib/file-storage.js';
import { CONFIG } from '../../src/config.js';

export const schema = {
  type: 'function',
  name: 'scrape',
  description: `Scrape web pages and extract content as markdown.
Supports single URL or batch scraping (up to 100 URLs).
Output modes: direct (returns content) or file (saves to disk).`,
  parameters: {
    type: 'object',
    properties: {
      urls: {
        oneOf: [
          { type: 'string', description: 'Single URL to scrape' },
          { type: 'array', items: { type: 'string' }, description: 'Array of URLs (max 100)' },
        ],
        description: 'URL(s) to scrape',
      },
      formats: {
        type: 'array',
        items: { type: 'string', enum: ['markdown', 'html', 'rawHtml', 'links', 'screenshot'] },
        description: 'Output formats. Default: ["markdown"]',
      },
      onlyMainContent: {
        type: 'boolean',
        description: 'Extract only main content, excluding headers/footers. Default: true',
      },
      outputMode: {
        type: 'string',
        enum: ['direct', 'file'],
        description: 'Override default output mode',
      },
    },
    required: ['urls'],
  },
};

export async function execute(args) {
  const urls = Array.isArray(args.urls) ? args.urls : [args.urls];
  const outputMode = args.outputMode ?? CONFIG.firecrawl.outputMode ?? 'direct';
  const saveToFile = outputMode === 'file';

  const scrapeOptions = {
    formats: args.formats ?? ['markdown'],
    onlyMainContent: args.onlyMainContent ?? true,
  };

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  try {
    if (urls.length === 1) {
      const firstUrl = urls[0];
      const result = await firecrawlClient.scrape(firstUrl, scrapeOptions);

      if (result.success && result.data) {
        const data = result.data;
        const pageTitle = data.metadata?.title;

        if (saveToFile) {
          const saved = await fileStorage.saveScrapeResult(firstUrl, {
            markdown: data.markdown,
            html: data.html,
            title: pageTitle,
            description: data.metadata?.description,
          });

          results.push({
            url: firstUrl,
            title: pageTitle,
            filePath: saved.filePath,
          });
        } else {
          results.push({
            url: firstUrl,
            title: pageTitle,
            markdown: data.markdown,
            html: data.html,
            links: data.links,
          });
        }
        successCount++;
      } else {
        results.push({
          url: firstUrl,
          error: result.error ?? 'Unknown error',
        });
        failureCount++;
      }
    } else {
      const batchResults = await firecrawlClient.batchScrape(urls, scrapeOptions, (completed, total) => {
        console.log(`Batch scrape progress: ${completed}/${total}`);
      });

      const resultsToSave = [];

      for (let i = 0; i < batchResults.length; i++) {
        const data = batchResults[i];
        const url = data?.metadata?.sourceURL ?? urls[i] ?? `url-${i}`;

        if (data) {
          if (saveToFile) {
            resultsToSave.push({
              url,
              markdown: data.markdown,
              html: data.html,
              title: data.metadata?.title,
              description: data.metadata?.description,
            });
          } else {
            results.push({
              url,
              title: data.metadata?.title,
              markdown: data.markdown,
              html: data.html,
              links: data.links,
            });
          }
          successCount++;
        } else {
          results.push({
            url,
            error: 'No data returned',
          });
          failureCount++;
        }
      }

      if (saveToFile && resultsToSave.length > 0) {
        const savedResults = await fileStorage.saveBatchScrapeResults(resultsToSave);

        for (const saved of savedResults) {
          const original = resultsToSave.find((r) => r.url === saved.url);
          results.push({
            url: saved.url,
            title: saved.title ?? original?.title,
            filePath: saved.filePath,
          });
        }
      }
    }
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error.message,
      urlCount: urls.length,
    });
  }

  const output = {
    success: failureCount === 0,
    mode: outputMode,
    results,
    totalUrls: urls.length,
    successCount,
    failureCount,
  };

  // Build response text
  let responseText;
  if (saveToFile) {
    responseText = `Scraped ${successCount}/${urls.length} URLs. Files saved to:\n${results
      .filter((r) => r.filePath)
      .map((r) => `- ${r.filePath}`)
      .join('\n')}`;
  } else {
    responseText = results
      .map((r) => {
        if (r.error) {
          return `## Error: ${r.url}\n${r.error}`;
        }
        const title = r.title ? `# ${r.title}\n\n` : '';
        const content = r.markdown ?? r.html ?? 'No content';
        return `## ${r.url}\n\n${title}${content}`;
      })
      .join('\n\n---\n\n');
  }

  return responseText;
}
