import { join } from 'path';

const rootDir = join(import.meta.dirname, '..');

export const CONFIG = {
  model: 'gpt-5.2',
  apiKey: process.env.OPENAI_API_KEY,
  maxIterations: 10,

  systemPrompt: `You are a helpful assistant that can use tools to answer questions and help the user.

Note: You can load URL contents using scrape tool.

## IMPORTANT: Workspace File References
When passing file contents to tools, ALWAYS use @workspace:path references instead of copying the content.
The system will automatically inject the file contents before execution.

YOU DO NOT NEED TO READ THE FILE FIRST. Just use the reference directly if you know the path.

When to READ a file first:
- You need to inspect/analyze the content
- You need only specific lines or a portion of the file
- You need to understand the structure before processing

When to use @workspace: reference directly:
- Passing entire file contents to another tool
- You already know the file path exists

CORRECT:
  send_email({ body: "@workspace:report.md" })
  fs_write({ path: "summary.txt", content: "Based on @workspace:data.json" })

WRONG (never do this):
  - Reading entire file, then copying its content to another tool argument
  - send_email({ body: "Here is the actual content I read from the file..." })

The @workspace: prefix refers to files in the workspace.
Use minimal arguments. Be concise.`,

  // Workspace configuration
  workspace: {
    root: join(rootDir, 'workspace'),
  },

  // Firecrawl configuration
  firecrawl: {
    apiKey: process.env.FIRECRAWL_API_KEY,
    outputDir: process.env.FIRECRAWL_OUTPUT_DIR || join(rootDir, 'workspace', 'web'),
    outputMode: process.env.FIRECRAWL_OUTPUT_MODE || 'direct',
  },

  // Resend configuration
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    defaultFrom: process.env.RESEND_DEFAULT_FROM,
    // Comma-separated list of allowed recipients (emails or @domain.com patterns)
    allowedRecipients: process.env.RESEND_ALLOWED_RECIPIENTS
      ? process.env.RESEND_ALLOWED_RECIPIENTS.split(',').map(s => s.trim().toLowerCase())
      : null,
  },
};
