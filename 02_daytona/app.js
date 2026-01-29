import * as readline from 'readline/promises';
import { CONFIG } from './src/config.js';
import { requireEnv, onShutdown } from './src/helpers.js';
import { initSandbox, destroySandbox } from './src/sandbox.js';
import { runAgentLoop } from './src/ai.js';

async function main() {
  requireEnv(CONFIG.apiKey, 'OPENAI_API_KEY');
  requireEnv(CONFIG.daytonaApiKey, 'DAYTONA_API_KEY');

  const sandbox = await initSandbox(CONFIG.daytonaApiKey, CONFIG.localDir);
  
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Daytona Agent with Progressive Skill Discovery            ║
╠════════════════════════════════════════════════════════════╣
║  Sandbox: ${sandbox.id.padEnd(46)} ║
║  Skills:  workspace/skills/                                ║
║  Tools:   list_skills, get_skill, execute_code, read_output║
╚════════════════════════════════════════════════════════════╝

Type "exit" to quit.
`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let responseId = null;

  const shutdown = onShutdown(async () => {
    await destroySandbox();
    rl.close();
  });

  while (true) {
    const input = await rl.question('You: ').catch(() => 'exit');
    if (input.toLowerCase() === 'exit') break;

    try {
      const result = await runAgentLoop({ 
        input, 
        apiKey: CONFIG.apiKey, 
        model: CONFIG.model,
        responseId,
        maxIterations: CONFIG.maxIterations
      });
      responseId = result.responseId;
      console.log(`\nAssistant: ${result.text}\n`);
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
    }
  }

  await shutdown();
}

main();
