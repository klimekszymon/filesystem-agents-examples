// Terminal colors (internal)
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

const formatSize = (bytes) => bytes > 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${bytes}B`;

const formatArgs = (args) => Object.entries(args).map(([k, v]) => {
  const val = typeof v === 'string' 
    ? (v.length > 40 ? `"${v.slice(0, 40)}..."` : `"${v}"`)
    : JSON.stringify(v);
  return `${c.yellow}${k}${c.reset}${c.dim}: ${val}${c.reset}`;
}).join(', ');

// Tool execution logging
export const logToolCall = (name, args) => 
  console.log(`  ${c.cyan}→${c.reset} ${c.cyan}${name}${c.reset}(${formatArgs(args)})`);

export const logInjectedRefs = (refs) => {
  for (const ref of refs) {
    if (ref.success) {
      console.log(`    ${c.blue}📎${c.reset} ${c.gray}${ref.path}${c.reset} ${c.dim}(${formatSize(ref.size)})${c.reset}`);
    } else {
      console.log(`    ${c.red}📎${c.reset} ${c.gray}${ref.path}${c.reset} ${c.red}${ref.error}${c.reset}`);
    }
  }
};

export const logToolSuccess = (result) => {
  console.log(`    ${c.green}✓${c.reset} ${formatSize(result.length)}`);
  try {
    console.log(JSON.stringify(JSON.parse(result), null, 2));
  } catch {
    console.log(result);
  }
};

export const logToolError = (err) => 
  console.log(`    ${c.red}✗ ${err.message}${c.reset}`);

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

// Workspace reference resolution
const WORKSPACE_REF_PATTERN = /@workspace:([^\s]+)/g;

const resolveReferencesInValue = async (value, readFile) => {
  if (typeof value !== 'string') return { resolved: value, injected: [] };
  
  const matches = [...value.matchAll(WORKSPACE_REF_PATTERN)];
  if (matches.length === 0) return { resolved: value, injected: [] };
  
  let resolved = value;
  const injected = [];
  
  for (const match of matches) {
    const [fullMatch, path] = match;
    try {
      const content = await readFile(path);
      resolved = resolved.replace(fullMatch, content);
      injected.push({ path, success: true, size: content.length });
    } catch (err) {
      injected.push({ path, success: false, error: err.message });
    }
  }
  return { resolved, injected };
};

export const resolveReferencesInArgs = async (args, readFile) => {
  const resolved = {};
  const allInjected = [];
  
  for (const [key, value] of Object.entries(args)) {
    const { resolved: val, injected } = await resolveReferencesInValue(value, readFile);
    resolved[key] = val;
    allInjected.push(...injected);
  }
  return { resolved, injected: allInjected };
};
