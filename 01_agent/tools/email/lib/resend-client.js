/**
 * Resend API client for sending emails.
 */

import { CONFIG } from '../../../src/config.js';

const RESEND_API_BASE = 'https://api.resend.com';

function getApiKey() {
  if (!CONFIG.resend.apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }
  return CONFIG.resend.apiKey;
}

async function request(method, path, body, queryParams) {
  const token = getApiKey();

  let url = `${RESEND_API_BASE}${path}`;

  if (queryParams) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    }
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Resend API error: ${response.status}`);
  }

  return response.json();
}

export async function sendEmail(params) {
  return request('POST', '/emails', params);
}

export async function getEmail(emailId) {
  return request('GET', `/emails/${emailId}`);
}

export async function cancelEmail(emailId) {
  return request('POST', `/emails/${emailId}/cancel`);
}

export async function listSegments(options) {
  return request('GET', '/segments', undefined, options);
}

export async function createBroadcast(params) {
  return request('POST', '/broadcasts', params);
}

export async function sendBroadcast(broadcastId, scheduledAt) {
  return request('POST', `/broadcasts/${broadcastId}/send`, scheduledAt ? { scheduled_at: scheduledAt } : undefined);
}
