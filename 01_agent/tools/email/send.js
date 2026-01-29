/**
 * send Tool - Send email to individuals or broadcast to segment.
 */

import * as resend from './lib/resend-client.js';
import { CONFIG } from '../../src/config.js';

/**
 * Check if a recipient email is allowed by the whitelist.
 * Supports exact email matches and domain patterns (e.g., @example.com).
 */
function isRecipientAllowed(email, allowedList) {
  if (!allowedList || allowedList.length === 0) return true;
  
  const normalizedEmail = email.toLowerCase();
  const domain = normalizedEmail.split('@')[1];
  
  return allowedList.some(pattern => {
    if (pattern.startsWith('@')) {
      // Domain pattern: @example.com matches user@example.com
      return domain === pattern.slice(1);
    }
    // Exact email match
    return normalizedEmail === pattern;
  });
}

/**
 * Validate all recipients against the whitelist.
 */
function validateRecipients(recipients, allowedList) {
  if (!allowedList || allowedList.length === 0) {
    return { valid: true };
  }
  
  const blocked = recipients.filter(email => !isRecipientAllowed(email, allowedList));
  
  if (blocked.length > 0) {
    return { valid: false, blocked };
  }
  
  return { valid: true };
}

export const schema = {
  type: 'function',
  name: 'send',
  description: `Send email to individuals or broadcast to a segment.

MODES:
- Individual: use "to" with email address(es) - up to 50 recipients
- Broadcast: use "segment" to send to all contacts in a segment

Content: provide "body" (text/HTML) or "template" (template ID)`,
  parameters: {
    type: 'object',
    properties: {
      to: {
        oneOf: [
          { type: 'string', description: 'Single email address' },
          { type: 'array', items: { type: 'string' }, description: 'Array of email addresses (max 50)' },
        ],
        description: 'Recipient email(s) for individual send',
      },
      segment: {
        type: 'string',
        description: 'Segment name for broadcast (sends to all contacts in segment)',
      },
      body: {
        type: 'string',
        description: 'Email content. Use \\n\\n between paragraphs. Supports {{{FIRST_NAME}}} personalization',
      },
      subject: {
        type: 'string',
        description: 'Email subject line (required for broadcast)',
      },
      from_name: {
        type: 'string',
        description: 'Sender display name',
      },
      reply_to: {
        type: 'string',
        description: 'Reply-to email address',
      },
      schedule_for: {
        type: 'string',
        description: 'Schedule send time. ISO 8601 or natural language ("in 30 minutes")',
      },
      template: {
        type: 'string',
        description: 'Template ID/alias to use instead of body',
      },
      variables: {
        type: 'object',
        description: 'Variables to inject into template',
      },
    },
  },
};

function hasHtmlTags(text) {
  return /<[a-z][\s\S]*>/i.test(text);
}

function textToHtml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>\n');
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">${escaped}</div>`;
}

function processContent(body) {
  if (hasHtmlTags(body)) {
    const textVersion = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return { html: body, text: textVersion };
  }
  return { text: body, html: textToHtml(body) };
}

export async function execute(args) {
  // Validate target
  if (!args.to && !args.segment) {
    return JSON.stringify({
      success: false,
      error: 'Provide either "to" (email addresses) or "segment" (segment name)',
    });
  }

  if (args.to && args.segment) {
    return JSON.stringify({
      success: false,
      error: 'Cannot use both "to" and "segment". Choose one.',
    });
  }

  // Validate content
  if (!args.body && !args.template) {
    return JSON.stringify({
      success: false,
      error: 'Provide either "body" (content) or "template" (template ID)',
    });
  }

  if (!CONFIG.resend.defaultFrom) {
    return JSON.stringify({
      success: false,
      error: 'RESEND_DEFAULT_FROM not configured',
    });
  }

  const fromAddress = args.from_name
    ? `${args.from_name} <${CONFIG.resend.defaultFrom}>`
    : CONFIG.resend.defaultFrom;

  // Individual email
  if (args.to) {
    const recipients = Array.isArray(args.to) ? args.to : [args.to];

    if (recipients.length > 50) {
      return JSON.stringify({
        success: false,
        error: 'Maximum 50 recipients per individual send. Use broadcast for larger sends.',
      });
    }

    // Validate recipients against whitelist
    const recipientCheck = validateRecipients(recipients, CONFIG.resend.allowedRecipients);
    if (!recipientCheck.valid) {
      return JSON.stringify({
        success: false,
        error: `Recipients not allowed: ${recipientCheck.blocked.join(', ')}. Check RESEND_ALLOWED_RECIPIENTS config.`,
      });
    }

    const emailParams = {
      from: fromAddress,
      to: recipients,
      subject: args.subject ?? 'No Subject',
      reply_to: args.reply_to,
      scheduled_at: args.schedule_for,
    };

    if (args.template) {
      emailParams.template = {
        id: args.template,
        variables: args.variables,
      };
    } else if (args.body) {
      const content = processContent(args.body);
      if (content.html) emailParams.html = content.html;
      if (content.text) emailParams.text = content.text;
    }

    try {
      const result = await resend.sendEmail(emailParams);

      const statusText = args.schedule_for ? `scheduled for ${args.schedule_for}` : 'sent';
      return JSON.stringify({
        success: true,
        id: result.id,
        to: recipients,
        subject: args.subject ?? 'No Subject',
        status: args.schedule_for ? 'scheduled' : 'sent',
        message: `Email ${statusText} to ${recipients.length} recipient(s)`,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }

  // Broadcast to segment
  if (args.segment) {
    try {
      const segments = await resend.listSegments();
      const segment = segments.data.find(
        (s) => s.name.toLowerCase() === args.segment.toLowerCase()
      );

      if (!segment) {
        return JSON.stringify({
          success: false,
          error: `Segment "${args.segment}" not found`,
        });
      }

      if (!args.subject) {
        return JSON.stringify({
          success: false,
          error: '"subject" is required for broadcast',
        });
      }

      const scheduleTime = args.schedule_for ?? 'in 5 minutes';

      const broadcastParams = {
        segment_id: segment.id,
        from: fromAddress,
        subject: args.subject,
        reply_to: args.reply_to,
        name: args.subject,
      };

      if (args.body) {
        const content = processContent(args.body);
        if (content.html) broadcastParams.html = content.html;
        if (content.text) broadcastParams.text = content.text;
      }

      const broadcast = await resend.createBroadcast(broadcastParams);
      await resend.sendBroadcast(broadcast.id, scheduleTime);

      return JSON.stringify({
        success: true,
        campaign_id: broadcast.id,
        segment: args.segment,
        subject: args.subject,
        status: 'scheduled',
        scheduled_at: scheduleTime,
        message: `Broadcast to segment "${args.segment}" scheduled for ${scheduleTime}`,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }

  return JSON.stringify({
    success: false,
    error: 'Invalid configuration',
  });
}
