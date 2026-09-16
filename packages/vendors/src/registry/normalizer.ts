// ============================================================================
// REQUEST/RESPONSE NORMALIZER
// Converts between vendor-specific formats and unified internal format
// Governance and scoring ONLY operate on unified format
// ============================================================================

import {
  UnifiedRequest,
  UnifiedResponse,
  UnifiedMessage,
  UnifiedTool,
  UnifiedToolCall,
  ModelDefinition,
  RegistryWarning,
} from './types';

/**
 * Normalize a request for a specific vendor
 * Returns vendor-specific request format
 */
export function normalizeRequestForVendor(
  request: UnifiedRequest,
  model: ModelDefinition
): Record<string, unknown> {
  switch (model.vendorId) {
    case 'openai':
      return normalizeForOpenAI(request, model);

    case 'anthropic':
      return normalizeForAnthropic(request, model);

    case 'google':
      return normalizeForGoogle(request, model);

    default:
      throw new Error(`Unsupported vendor in v0.1.0: ${model.vendorId}`);
  }
}

/**
 * Normalize a vendor response to unified format
 */
export function normalizeVendorResponse(
  vendorResponse: Record<string, unknown>,
  model: ModelDefinition,
  requestedModel: string,
  latencyMs: number
): UnifiedResponse {
  switch (model.vendorId) {
    case 'openai':
      return normalizeOpenAIResponse(vendorResponse, model, requestedModel, latencyMs);

    case 'anthropic':
      return normalizeAnthropicResponse(vendorResponse, model, requestedModel, latencyMs);

    case 'google':
      return normalizeGoogleResponse(vendorResponse, model, requestedModel, latencyMs);

    default:
      throw new Error(`Unsupported vendor in v0.1.0: ${model.vendorId}`);
  }
}

// ============================================================================
// VENDOR-SPECIFIC NORMALIZERS
// ============================================================================

function normalizeForOpenAI(request: UnifiedRequest, model: ModelDefinition): Record<string, unknown> {
  const messages: Array<{ role: string; content: unknown }> = [];
  
  // Handle system instruction
  if (request.systemInstruction) {
    messages.push({
      role: 'system',
      content: request.systemInstruction,
    });
  }
  
  // Convert messages
  for (const msg of request.messages) {
    if (msg.role === 'system' && messages.some(m => m.role === 'system')) {
      continue; // Skip duplicate system messages
    }
    
    messages.push({
      role: msg.role,
      content: typeof msg.content === 'string' 
        ? msg.content 
        : convertContentPartsForOpenAI(msg.content),
      ...(msg.name && { name: msg.name }),
      ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
      ...(msg.toolCalls && { tool_calls: msg.toolCalls.map(convertToolCallForOpenAI) }),
    });
  }
  
  const result: Record<string, unknown> = {
    model: model.vendorModelId,
    messages,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.maxTokens ?? model.maxOutputTokens,
  };
  
  // Add tools if present
  if (request.tools && request.tools.length > 0) {
    result.tools = request.tools.map(t => ({
      type: 'function',
      function: t.function,
    }));
  }
  
  // Add response format
  if (request.jsonMode) {
    result.response_format = { type: 'json_object' };
  }
  
  // Handle reasoning models (o-series)
  if (model.capabilities.reasoning && request.reasoningEnabled) {
    result.reasoning_effort = request.reasoningBudget ?? 'medium';
  }
  
  if (request.stopSequences) {
    result.stop = request.stopSequences;
  }
  
  return result;
}

function normalizeForAnthropic(request: UnifiedRequest, model: ModelDefinition): Record<string, unknown> {
  const messages: Array<{ role: string; content: unknown }> = [];
  
  // Anthropic doesn't use 'system' role in messages
  for (const msg of request.messages) {
    if (msg.role === 'system') continue;
    
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: typeof msg.content === 'string'
        ? msg.content
        : convertContentPartsForAnthropic(msg.content),
    });
  }
  
  const result: Record<string, unknown> = {
    model: model.vendorModelId,
    messages,
    max_tokens: request.maxTokens ?? model.maxOutputTokens,
  };
  
  // System goes in a separate field
  const systemContent = request.systemInstruction || 
    request.messages.find(m => m.role === 'system')?.content;
  if (systemContent) {
    result.system = typeof systemContent === 'string' 
      ? systemContent 
      : (systemContent as any)[0]?.text;
  }
  
  if (request.temperature !== undefined) {
    result.temperature = request.temperature;
  }
  
  // Add tools
  if (request.tools && request.tools.length > 0) {
    result.tools = request.tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }
  
  // Extended thinking for Claude 3.5+ / 4
  if (model.capabilities.reasoning && request.reasoningEnabled) {
    result.thinking = {
      type: 'enabled',
      budget_tokens: request.reasoningBudget ?? 10000,
    };
  }
  
  return result;
}

function normalizeForGoogle(request: UnifiedRequest, model: ModelDefinition): Record<string, unknown> {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  
  for (const msg of request.messages) {
    if (msg.role === 'system') continue;
    
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: typeof msg.content === 'string'
        ? [{ text: msg.content }]
        : convertContentPartsForGoogle(msg.content),
    });
  }
  
  const result: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: request.maxTokens ?? model.maxOutputTokens,
      temperature: request.temperature ?? 0.7,
    },
  };
  
  // System instruction
  const systemContent = request.systemInstruction ||
    request.messages.find(m => m.role === 'system')?.content;
  if (systemContent) {
    result.systemInstruction = {
      parts: [{ text: typeof systemContent === 'string' ? systemContent : (systemContent as any)[0]?.text }],
    };
  }
  
  // Tools
  if (request.tools && request.tools.length > 0) {
    result.tools = [{
      functionDeclarations: request.tools.map(t => t.function),
    }];
  }
  
  return result;
}


// ============================================================================
// RESPONSE NORMALIZERS
// ============================================================================

function normalizeOpenAIResponse(
  response: Record<string, unknown>,
  model: ModelDefinition,
  requestedModel: string,
  latencyMs: number
): UnifiedResponse {
  const choice = (response.choices as any[])?.[0] || {};
  const message = choice.message || {};
  const usage = response.usage as any || {};
  
  return {
    content: message.content || '',
    toolCalls: message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    })),
    usage: {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
    },
    finishReason: mapFinishReason(choice.finish_reason),
    model: {
      requestedModel,
      resolvedModel: model.modelId,
      vendorId: model.vendorId,
      vendorModelId: response.model as string || model.vendorModelId,
    },
    governanceMetadata: {
      reasoningTrace: message.reasoning_content,
    },
    latencyMs,
    warnings: [],
  };
}

function normalizeAnthropicResponse(
  response: Record<string, unknown>,
  model: ModelDefinition,
  requestedModel: string,
  latencyMs: number
): UnifiedResponse {
  const content = response.content as any[] || [];
  const usage = response.usage as any || {};
  
  // Extract text content
  const textContent = content
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('');
  
  // Extract tool use
  const toolUse = content
    .filter((c: any) => c.type === 'tool_use')
    .map((c: any) => ({
      id: c.id,
      type: 'function' as const,
      function: {
        name: c.name,
        arguments: JSON.stringify(c.input),
      },
    }));
  
  // Extract thinking content
  const thinkingContent = content
    .filter((c: any) => c.type === 'thinking')
    .map((c: any) => c.thinking)
    .join('\n');
  
  return {
    content: textContent,
    toolCalls: toolUse.length > 0 ? toolUse : undefined,
    usage: {
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      cachedTokens: usage.cache_read_input_tokens,
    },
    finishReason: mapFinishReason(response.stop_reason as string),
    model: {
      requestedModel,
      resolvedModel: model.modelId,
      vendorId: model.vendorId,
      vendorModelId: response.model as string || model.vendorModelId,
    },
    governanceMetadata: {
      reasoningTrace: thinkingContent || undefined,
    },
    latencyMs,
    warnings: [],
  };
}

function normalizeGoogleResponse(
  response: Record<string, unknown>,
  model: ModelDefinition,
  requestedModel: string,
  latencyMs: number
): UnifiedResponse {
  const candidates = response.candidates as any[] || [];
  const candidate = candidates[0] || {};
  const content = candidate.content || {};
  const parts = content.parts || [];
  const usage = response.usageMetadata as any || {};
  
  const textContent = parts
    .filter((p: any) => p.text)
    .map((p: any) => p.text)
    .join('');
  
  const toolCalls = parts
    .filter((p: any) => p.functionCall)
    .map((p: any) => ({
      id: `call_${Math.random().toString(36).substr(2, 9)}`,
      type: 'function' as const,
      function: {
        name: p.functionCall.name,
        arguments: JSON.stringify(p.functionCall.args),
      },
    }));
  
  return {
    content: textContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: {
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || 0,
    },
    finishReason: mapFinishReason(candidate.finishReason),
    model: {
      requestedModel,
      resolvedModel: model.modelId,
      vendorId: model.vendorId,
      vendorModelId: model.vendorModelId,
    },
    governanceMetadata: {
      safetyRatings: candidate.safetyRatings?.map((r: any) => ({
        category: r.category,
        probability: r.probability,
      })),
    },
    latencyMs,
    warnings: [],
  };
}


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function convertContentPartsForOpenAI(parts: any[]): any[] {
  return parts.map(part => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text };
    }
    if (part.type === 'image') {
      return {
        type: 'image_url',
        image_url: { url: part.imageUrl || `data:${part.mimeType};base64,${part.imageBase64}` },
      };
    }
    return part;
  });
}

function convertContentPartsForAnthropic(parts: any[]): any[] {
  return parts.map(part => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text };
    }
    if (part.type === 'image') {
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: part.mimeType,
          data: part.imageBase64,
        },
      };
    }
    return part;
  });
}

function convertContentPartsForGoogle(parts: any[]): any[] {
  return parts.map(part => {
    if (part.type === 'text') {
      return { text: part.text };
    }
    if (part.type === 'image') {
      return {
        inlineData: {
          mimeType: part.mimeType,
          data: part.imageBase64,
        },
      };
    }
    return part;
  });
}

function convertToolCallForOpenAI(tc: UnifiedToolCall): any {
  return {
    id: tc.id,
    type: 'function',
    function: {
      name: tc.function.name,
      arguments: tc.function.arguments,
    },
  };
}


function mapFinishReason(vendorReason: string | undefined): UnifiedResponse['finishReason'] {
  if (!vendorReason) return 'stop';
  
  const mapping: Record<string, UnifiedResponse['finishReason']> = {
    // OpenAI
    'stop': 'stop',
    'length': 'length',
    'tool_calls': 'tool_calls',
    'content_filter': 'content_filter',
    
    // Anthropic
    'end_turn': 'stop',
    'max_tokens': 'length',
    'tool_use': 'tool_calls',
    
    // Google
    'STOP': 'stop',
    'MAX_TOKENS': 'length',
    'SAFETY': 'content_filter',
    'RECITATION': 'content_filter',
  };
  
  return mapping[vendorReason] || 'stop';
}
