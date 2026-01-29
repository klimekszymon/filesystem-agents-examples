import { toolDefinitions, executeTool } from './tools.js';
import { CONFIG } from './config.js';
import { 
  extractText, extractToolCalls, toToolResult, safeJsonParse,
  logToolStart, logToolEnd 
} from './helpers.js';

// Private helpers
async function createCompletion({ apiKey, model, tools, input, previousResponseId }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      instructions: CONFIG.systemPrompt,
      input,
      tools,
      ...(previousResponseId && { previous_response_id: previousResponseId })
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  return { output: data.output, responseId: data.id };
}

async function executeCall(call) {
  const args = safeJsonParse(call.arguments);
  logToolStart(call.name, args);
  
  const result = await executeTool(call.name, args);
  logToolEnd(call.name, result);
  
  return toToolResult(call.call_id, result);
}

// Public API
export async function runAgentLoop({ input, apiKey, model, responseId = null, iteration = 0, maxIterations }) {
  if (iteration >= maxIterations) throw new Error('Max iterations reached');

  const tools = [{ type: 'web_search' }, ...toolDefinitions];
  
  const { output, responseId: newId } = await createCompletion({ 
    apiKey, model, tools, input, previousResponseId: responseId 
  });

  const toolCalls = extractToolCalls(output);
  
  if (toolCalls.length === 0) {
    return { text: extractText(output), responseId: newId };
  }

  const results = await Promise.all(toolCalls.map(executeCall));

  return runAgentLoop({ 
    input: results, apiKey, model, 
    responseId: newId, iteration: iteration + 1, maxIterations 
  });
}
