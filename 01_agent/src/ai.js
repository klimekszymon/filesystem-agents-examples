import { 
  extractText, extractToolCalls, toToolResult, resolveReferencesInArgs,
  logToolCall, logInjectedRefs, logToolSuccess, logToolError, safeJsonParse 
} from './helpers.js';
import { CONFIG } from './config.js';

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

async function executeCall(call, { executeTool, readFile }) {
  const parsedArgs = safeJsonParse(call.arguments);
  logToolCall(call.name, parsedArgs);
  
  let args = parsedArgs;
  if (readFile) {
    const { resolved, injected } = await resolveReferencesInArgs(parsedArgs, readFile);
    logInjectedRefs(injected);
    args = resolved;
  }
  
  try {
    const result = await executeTool(call.name, args);
    logToolSuccess(result);
    return toToolResult(call.call_id, result);
  } catch (err) {
    logToolError(err);
    return toToolResult(call.call_id, `Error: ${err.message}`);
  }
}

// Public API
export async function runAgentLoop({ input, tools, executeTool, readFile, apiKey, model, responseId = null, maxIterations }) {
  let messages = input;
  let conversationId = responseId;

  for (let i = 0; i < maxIterations; i++) {
    const { output, responseId: newId } = await createCompletion({ 
      apiKey, model, tools, input: messages, previousResponseId: conversationId 
    });

    conversationId = newId;
    const toolCalls = extractToolCalls(output);
    
    if (toolCalls.length === 0) {
      return { text: extractText(output), responseId: conversationId, completed: true };
    }

    messages = await Promise.all(
      toolCalls.map(call => executeCall(call, { executeTool, readFile }))
    );
  }

  return { text: '[Max iterations reached]', responseId: conversationId, completed: false };
}