/**
 * Firecrawl API client with rate limiting and retry logic.
 */

import { CONFIG } from '../../../src/config.js';

class RateLimiter {
  constructor(requestsPerMinute) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.refillRate = requestsPerMinute / 60000;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async acquire() {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const waitTime = (1 - this.tokens) / this.refillRate;
    await this.sleep(waitTime);
    this.refill();
    this.tokens -= 1;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class FirecrawlClient {
  constructor() {
    this.baseUrl = 'https://api.firecrawl.dev/v1';
    this.apiKey = CONFIG.firecrawl.apiKey;
    this.rateLimiter = new RateLimiter(20);
    this.maxRetries = 3;
    this.retryAfterMs = 1000;
  }

  async scrape(url, options = {}) {
    const body = {
      url,
      formats: options.formats ?? ['markdown'],
      onlyMainContent: options.onlyMainContent,
      includeTags: options.includeTags,
      excludeTags: options.excludeTags,
      waitFor: options.waitFor,
      timeout: options.timeout,
    };

    return this.request('/scrape', 'POST', body);
  }

  async batchScrape(urls, options = {}, onProgress) {
    const body = {
      urls,
      formats: options.formats ?? ['markdown'],
      onlyMainContent: options.onlyMainContent,
    };

    const startResponse = await this.request('/batch/scrape', 'POST', body);

    if (!startResponse.success || !startResponse.id) {
      throw new Error(startResponse.error ?? 'Failed to start batch scrape');
    }

    const jobId = startResponse.id;
    const results = [];
    let nextUrl = `/batch/scrape/${jobId}`;

    while (nextUrl) {
      await this.sleep(2000);

      const statusPath = nextUrl.startsWith('http')
        ? new URL(nextUrl).pathname + new URL(nextUrl).search
        : nextUrl;

      const status = await this.request(statusPath, 'GET');

      if (onProgress) {
        onProgress(status.completed, status.total);
      }

      if (status.status === 'failed') {
        throw new Error(status.error ?? 'Batch scrape failed');
      }

      if (status.data) {
        results.push(...status.data);
      }

      if (status.status === 'completed' && !status.next) {
        break;
      }

      nextUrl = status.next;
    }

    return results;
  }

  async request(path, method, body) {
    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      await this.rateLimiter.acquire();

      try {
        const url = `${this.baseUrl}${path}`;

        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : this.retryAfterMs * (attempt + 1);

          await this.sleep(waitTime);
          continue;
        }

        if (response.status >= 500) {
          await this.sleep(this.retryAfterMs * (attempt + 1));
          continue;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? `HTTP ${response.status}`);
        }

        return data;
      } catch (error) {
        lastError = error;

        if (attempt < this.maxRetries) {
          await this.sleep(this.retryAfterMs * (attempt + 1));
        }
      }
    }

    throw lastError ?? new Error('Max retries exceeded');
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const firecrawlClient = new FirecrawlClient();
