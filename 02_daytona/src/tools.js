import { 
  uploadFile, downloadFile, deleteFile, executeCommand, SANDBOX_ROOT 
} from './sandbox.js';
import { listSkills, getSkillSchema } from './skill-registry.js';

// Tool handlers
async function handleListSkills() {
  return JSON.stringify({ skills: listSkills() }, null, 2);
}

async function handleGetSkill({ name }) {
  const schema = getSkillSchema(name);
  if (!schema) {
    return JSON.stringify({ error: `Skill not found: ${name}` });
  }
  return JSON.stringify(schema, null, 2);
}

async function handleExecuteCode({ code }) {
  const lines = code.split('\n');
  const imports = lines.filter(l => l.trim().startsWith('import '));
  const body = lines.filter(l => !l.trim().startsWith('import '));
  
  const wrappedCode = `
import { writeFileSync } from 'fs';
${imports.join('\n')}

const __main = async () => {
${body.join('\n')}
};

__main().catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
});
`;

  const filename = `_exec_${Date.now()}.mjs`;
  const tempPath = `${SANDBOX_ROOT}/${filename}`;
  
  try {
    await uploadFile(filename, wrappedCode);
    const response = await executeCommand(`node ${filename}`);
    await deleteFile(tempPath);
    
    const output = response.result || response.artifacts?.stdout || '(no output)';
    return `[exit ${response.exitCode ?? -1}]\n${output}`.trim();
  } catch (err) {
    await deleteFile(tempPath);
    return `[error] ${err.message}`;
  }
}

async function handleShell({ command }) {
  try {
    const response = await executeCommand(command);
    const output = response.result || response.artifacts?.stdout || '(no output)';
    return `[exit ${response.exitCode}]\n${output}`.trim();
  } catch (err) {
    return `[error] ${err.message}`;
  }
}

async function handleReadOutput({ path }) {
  try {
    const content = await downloadFile(path);
    return content || '(empty file)';
  } catch (err) {
    return `Error reading ${path}: ${err.message}`;
  }
}

const toolHandlers = {
  list_skills: handleListSkills,
  get_skill: handleGetSkill,
  execute_code: handleExecuteCode,
  shell: handleShell,
  read_output: handleReadOutput,
};

// Tool definitions for OpenAI
export const toolDefinitions = [
  {
    type: 'function',
    name: 'shell',
    description: 'Run a shell command in the sandbox (for debugging).',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to run' }
      },
      required: ['command']
    }
  },
  {
    type: 'function',
    name: 'list_skills',
    description: 'List available skills. Start here to discover capabilities.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    type: 'function',
    name: 'get_skill',
    description: 'Get TypeScript type definition for a skill. Load before using in execute_code.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill name from list_skills' }
      },
      required: ['name']
    }
  },
  {
    type: 'function',
    name: 'execute_code',
    description: 'Execute JavaScript in sandbox. Import skills: import { x } from \'./skills/name.js\'. Use console.log() for output.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code to execute' }
      },
      required: ['code']
    }
  },
  {
    type: 'function',
    name: 'read_output',
    description: 'Read a file created by execute_code.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace' }
      },
      required: ['path']
    }
  }
];

// Public API
export async function executeTool(name, args) {
  const handler = toolHandlers[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(args);
}
