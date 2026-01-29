// Terminal colors (internal)
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

const formatSize = (bytes) => bytes > 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${bytes}B`;

const formatArgs = (args) => Object.entries(args).map(([k, v]) => {
  const val = typeof v === 'string' 
    ? (v.length > 60 ? `"${v.slice(0, 60)}..."` : `"${v}"`)
    : JSON.stringify(v);
  return `${c.yellow}${k}${c.reset}${c.dim}=${val}${c.reset}`;
}).join(', ');

// Tool execution logging
export const logToolStart = (name, args) => {
  const argsStr = Object.keys(args).length > 0 ? formatArgs(args) : '';
  console.log(`\n  ${c.cyan}━━━ ${name}(${argsStr}) ━━━${c.reset}`);
};

export const logToolEnd = (name, result) => {
  console.log(`${c.gray}${result}${c.reset}`);
  console.log(`  ${c.cyan}━━━ /${name} ━━━${c.reset}\n`);
};

// Guards
export const requireEnv = (value, name) => {
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
};

export const onShutdown = (cleanup) => {
  const handler = async () => {
    console.log('\nShutting down...');
    await cleanup();
    process.exit(0);
  };
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
  return handler;
};

// Pure helpers
export const safeJsonParse = (json, fallback = {}) => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

export const extractText = (output) => 
  output?.find(o => o.type === 'message')?.content?.find(c => c.type === 'output_text')?.text || '';

export const extractToolCalls = (output) => 
  output?.filter(o => o.type === 'function_call') || [];

export const toToolResult = (callId, output) => 
  ({ type: 'function_call_output', call_id: callId, output });
