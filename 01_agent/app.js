import * as readline from 'readline/promises';
import { CONFIG } from './src/config.js';
import { requireEnv, onShutdown } from './src/helpers.js';
import { tools, executeTool, readFile } from './tools/index.js';
import { runAgentLoop } from './src/ai.js';

async function main() {
  requireEnv(CONFIG.apiKey, 'OPENAI_API_KEY');

  const allTools = [{ type: 'web_search' }, ...tools];
  
  console.log(`\nAgent ready (${allTools.length} tools). Type "exit" to quit.\n`);
  console.log(`Tools: ${tools.map(t => t.name).join(', ')}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let responseId = null;

  const shutdown = onShutdown(async () => {
    rl.close();
  });

  while (true) {
    const input = await rl.question('You: ').catch(() => 'exit');
    if (input.toLowerCase() === 'exit') break;

    try {
      const result = await runAgentLoop({ 
        input, 
        tools: allTools, 
        executeTool,
        readFile,
        apiKey: CONFIG.apiKey, 
        model: CONFIG.model,
        responseId,
        maxIterations: CONFIG.maxIterations
      });
      responseId = result.responseId;
      console.log(`\nAssistant: ${result.text}\n`);
      if (!result.completed) break;
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
    }
  }

  await shutdown();
}

main();
